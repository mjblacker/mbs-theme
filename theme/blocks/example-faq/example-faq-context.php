<?php

$id = 'faq-' . $block['id']
// Load values and assign defaults.
// $delay = empty(get_field('delay')) ? 5000 : get_field('delay');
$titleIconDisabled = get_field('title_icon_disabled') ?? false;
$titleIconPosition = get_field('icon_position') ?? 'left';

$faqSchema = [];

foreach($items as $index => $item) {
    $faqSchema[] = [
        'question' => $item['question'],
        'answer' => $item['answer'],
    ];

}

function generateFaqSchema(array $data)
{

    // data passed in as assoc array with keys "question" and "answer"
    // restructure to JSON-LD format so we can just encode
    $schemaJson = json_encode(faqSchemaFromArray($data));

    $faqSchema = "
	<script type=\"application/ld+json\">
		$schemaJson
	</script>
	";

    return $faqSchema;
}

$schema_html = generate_schema($faqSchema);
