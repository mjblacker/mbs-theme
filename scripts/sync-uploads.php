<?php
/**
 * Load with WP-CLI's --require option; see `lando sync-uploads --help`.
 */

if (!defined('WP_CLI') || !WP_CLI) {
    return;
}

class MBS_Sync_Uploads_Command
{
    private array $files = [];
    private string $uploadsPath;
    private array $hosts = [];

    /**
     * Download missing uploads in yearly folders referenced by the local database.
     *
     * ## OPTIONS
     *
     * <source>
     * : Source hostname or HTTP(S) site URL. Bare hostnames use HTTPS.
     *
     * [--dry-run]
     * : List missing files without downloading or creating directories.
     *
     * [--limit=<number>]
     * : Stop after this many missing files (useful for a small test run).
     *
     * ## EXAMPLES
     *
     *     lando sync-uploads metrobuildingsupplies.com.au --dry-run
     *     lando sync-uploads https://metrobuildingsupplies.com.au/ --limit=5
     */
    public function __invoke(array $args, array $assocArgs): void
    {
        $source = rtrim($args[0], '/');
        if (!str_contains($source, '://')) {
            $source = 'https://' . $source;
        }
        $url = wp_parse_url($source);
        if (!$url || empty($url['host']) || !in_array($url['scheme'] ?? '', ['http', 'https'], true)
            || isset($url['user']) || isset($url['pass'])
            || isset($url['query']) || isset($url['fragment'])) {
            WP_CLI::error('Provide a hostname or HTTP(S) site URL without credentials, a query, or a fragment.');
        }

        $limit = $assocArgs['limit'] ?? null;
        if ($limit !== null && (!ctype_digit((string) $limit) || (int) $limit < 1)) {
            WP_CLI::error('--limit must be a positive integer.');
        }
        $limit = $limit === null ? PHP_INT_MAX : (int) $limit;
        $dryRun = isset($assocArgs['dry-run']);
        // Do not create the uploads directory during discovery or a dry run.
        $uploads = wp_upload_dir(null, false);
        if ($uploads['error']) {
            WP_CLI::error($uploads['error']);
        }
        $this->uploadsPath = wp_parse_url($uploads['baseurl'], PHP_URL_PATH) ?: '/wp-content/uploads';
        foreach ([$source, $uploads['baseurl'], home_url(), site_url()] as $site) {
            $host = wp_parse_url($site, PHP_URL_HOST);
            if ($host) {
                $this->hosts[] = strtolower($host);
            }
        }
        $directory = rtrim($uploads['basedir'], '/');
        $remote = $source . $this->uploadsPath;

        WP_CLI::log('Scanning the local database for upload references...');
        $this->discover();
        ksort($this->files);
        WP_CLI::log(sprintf('Found %d unique upload paths. Source: %s', count($this->files), $remote));

        $existing = $missing = $downloaded = $failed = 0;
        foreach (array_keys($this->files) as $file) {
            $destination = $directory . '/' . $file;
            // Also preserve broken symlinks and directories instead of replacing them.
            if (file_exists($destination) || is_link($destination)) {
                $existing++;
                continue;
            }
            if ($missing >= $limit) {
                WP_CLI::log('Missing-file limit reached; rerun without --limit to check all files.');
                break;
            }
            $missing++;
            $fileUrl = $remote . '/' . implode('/', array_map('rawurlencode', explode('/', $file)));
            if ($dryRun) {
                WP_CLI::log('[dry-run] ' . $fileUrl);
                continue;
            }
            if ($this->download($fileUrl, $destination, $directory)) {
                $downloaded++;
                WP_CLI::log('Downloaded: ' . $file);
            } else {
                $failed++;
            }
        }

        WP_CLI::log(sprintf(
            '%d existing, %d missing checked, %d downloaded, %d failed.',
            $existing, $missing, $downloaded, $failed
        ));
        if ($failed) {
            WP_CLI::error('Some files could not be downloaded. Rerun to retry missing files.');
        }
        WP_CLI::success($dryRun ? 'Dry run complete; no files were changed.' : 'Missing uploads refreshed.');
    }

    private function addFile(string $file): void
    {
        // Only sync media inside a top-level YYYY/ uploads folder.
        if (!preg_match('~^[0-9]{4}/~', $file)) {
            return;
        }
        // Metadata paths are already decoded; only URL references are URL-decoded.
        if ($file === '' || str_starts_with($file, '/') || preg_match('/[\\\\\x00-\x1f\x7f]/', $file)) {
            return;
        }
        foreach (explode('/', $file) as $part) {
            if ($part === '' || $part === '.' || $part === '..') {
                return;
            }
        }
        $this->files[$file] = true;
    }

    private function scanValue($value): void
    {
        if (is_array($value)) {
            foreach ($value as $child) {
                $this->scanValue($child);
            }
            return;
        }
        if (!is_string($value)) {
            return;
        }
        if (is_serialized($value)) {
            $this->scanValue(@unserialize($value, ['allowed_classes' => false]));
            return;
        }
        // Covers JSON-escaped URLs in block content and plugin settings.
        $value = html_entity_decode(str_replace('\\/', '/', $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $paths = array_unique([$this->uploadsPath, '/wp-content/uploads']);
        $relativePaths = implode('|', array_map(fn($path) => preg_quote(rtrim($path, '/') . '/', '~'), $paths));
        // Capture an entire absolute URL before considering relative paths. This
        // retains the hostname even when the remote site lives in a subdirectory.
        preg_match_all('~(?:https?:)?//[^\s<>"\'\\\\]+|(?<![a-zA-Z0-9_./%:-])(?:'
            . $relativePaths . ')[^\s<>"\'?#\\\\]+~i', $value, $matches);
        foreach ($matches[0] as $reference) {
            $url = wp_parse_url($reference);
            if (!$url || (isset($url['host']) && !in_array(strtolower($url['host']), $this->hosts, true))) {
                continue;
            }
            $urlPath = $url['path'] ?? '';
            foreach ($paths as $path) {
                $prefix = rtrim($path, '/') . '/';
                if (str_starts_with($urlPath, $prefix)) {
                    $this->addFile(rawurldecode(substr($urlPath, strlen($prefix))));
                    break;
                }
            }
        }
    }

    private function attachmentFiles(object $row): void
    {
        if ($row->meta_key === '_wp_attached_file') {
            $this->addFile($row->meta_value);
            return;
        }
        if (!in_array($row->meta_key, ['_wp_attachment_metadata', '_wp_attachment_backup_sizes'], true)) {
            return;
        }
        $metadata = @unserialize($row->meta_value, ['allowed_classes' => false]);
        if (!is_array($metadata)) {
            return;
        }
        $file = $metadata['file'] ?? get_post_meta((int) $row->post_id, '_wp_attached_file', true);
        if (!is_string($file) || $file === '') {
            return;
        }
        $this->addFile($file);
        $prefix = dirname($file) === '.' ? '' : dirname($file) . '/';
        if (!empty($metadata['original_image'])) {
            $this->addFile($prefix . $metadata['original_image']);
        }
        $sizes = $row->meta_key === '_wp_attachment_backup_sizes' ? $metadata : ($metadata['sizes'] ?? []);
        foreach ($sizes as $size) {
            if (is_array($size) && !empty($size['file'])) {
                $this->addFile($prefix . $size['file']);
            }
        }
    }

    private function discover(): void
    {
        global $wpdb;

        // Keyset pagination keeps large imported databases from loading all rows at once.
        $tables = [
            [$wpdb->posts, 'ID', 'post_content, post_excerpt'],
            [$wpdb->postmeta, 'meta_id', 'post_id, meta_key, meta_value'],
            [$wpdb->options, 'option_id', 'option_name, option_value'],
            [$wpdb->termmeta, 'meta_id', 'meta_value'],
        ];
        foreach ($tables as [$table, $key, $columns]) {
            $lastId = 0;
            do {
                $rows = $wpdb->get_results($wpdb->prepare(
                    "SELECT {$key}, {$columns} FROM `{$table}` WHERE {$key} > %d ORDER BY {$key} LIMIT 500",
                    $lastId
                ));
                if ($wpdb->last_error) {
                    WP_CLI::error('Database scan failed: ' . $wpdb->last_error);
                }
                foreach ($rows as $row) {
                    $lastId = (int) $row->$key;
                    // Transients are cached data, often external plugin catalogues.
                    if ($table === $wpdb->options && preg_match('/(?:^|_)transient_/', $row->option_name)) {
                        continue;
                    }
                    if ($table === $wpdb->postmeta) {
                        $this->attachmentFiles($row);
                    }
                    foreach (get_object_vars($row) as $value) {
                        $this->scanValue($value);
                    }
                }
            } while (count($rows) === 500);
        }
    }

    private function download(string $url, string $destination, string $directory): bool
    {
        $parent = dirname($destination);
        if (!wp_mkdir_p($directory)) {
            WP_CLI::warning('Cannot create uploads directory: ' . $directory);
            return false;
        }
        // Do not follow a nested uploads symlink outside the local uploads directory.
        $ancestor = $parent;
        while (!file_exists($ancestor) && !is_link($ancestor)) {
            $ancestor = dirname($ancestor);
        }
        $root = realpath($directory);
        $resolved = realpath($ancestor);
        if ($root === false || $resolved === false || ($resolved !== $root && !str_starts_with($resolved, $root . '/'))) {
            WP_CLI::warning('Destination is outside uploads: ' . $destination);
            return false;
        }
        if (!wp_mkdir_p($parent)) {
            WP_CLI::warning('Cannot create directory: ' . $parent);
            return false;
        }
        $temporary = tempnam($parent, '.sync-uploads-');
        if ($temporary === false) {
            WP_CLI::warning('Cannot create temporary file for: ' . $destination);
            return false;
        }
        try {
            $response = wp_remote_get($url, [
                'timeout' => 60,
                'redirection' => 5,
                'stream' => true,
                'filename' => $temporary,
            ]);
            if (is_wp_error($response)) {
                WP_CLI::warning($url . ': ' . $response->get_error_message());
                return false;
            }
            $status = wp_remote_retrieve_response_code($response);
            $type = strtolower((string) wp_remote_retrieve_header($response, 'content-type'));
            if ($status !== 200 || filesize($temporary) === 0 || str_contains($type, 'text/html')) {
                WP_CLI::warning(sprintf('%s: HTTP %d, empty file, or HTML response; skipped.', $url, $status));
                return false;
            }
            chmod($temporary, 0644);
            // An atomic hard link publishes the completed file without overwriting
            // a file created by another process during the download.
            if (!@link($temporary, $destination)) {
                WP_CLI::warning('Could not save without overwriting: ' . $destination);
                return false;
            }
            return true;
        } finally {
            unlink($temporary);
        }
    }
}

WP_CLI::add_command('sync-uploads', MBS_Sync_Uploads_Command::class);
