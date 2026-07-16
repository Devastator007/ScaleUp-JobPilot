<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$keywords = normalize_terms($input['keywords'] ?? '');
$platforms = normalize_terms($input['platforms'] ?? 'LinkedIn, Indeed, Wuzzuf');
$location = trim((string)($input['location'] ?? 'Remote'));
$exclusions = normalize_terms($input['exclusions'] ?? '');
$limit = max(1, min(30, (int)($input['limit'] ?? 20)));

if (!$keywords) {
    http_response_code(400);
    echo json_encode(['error' => 'At least one keyword is required']);
    exit;
}

$jobs = [];
foreach ($keywords as $keyword) {
    foreach ($platforms as $platform) {
        $platformKey = strtolower($platform);
        if (str_contains($platformKey, 'linkedin')) {
            $jobs = array_merge($jobs, scrape_linkedin($keyword, $location));
        } elseif (str_contains($platformKey, 'indeed')) {
            $jobs = array_merge($jobs, scrape_indeed($keyword, $location));
        } elseif (str_contains($platformKey, 'wuzzuf')) {
            $jobs = array_merge($jobs, scrape_wuzzuf($keyword, $location));
        }
        if (count($jobs) >= $limit * 2) break 2;
    }
}

$seen = [];
$filtered = [];
foreach ($jobs as $job) {
    $url = $job['url'] ?? '';
    $title = $job['title'] ?? '';
    if (!$url || isset($seen[$url])) continue;
    $seen[$url] = true;
    if (contains_exclusion($title . ' ' . ($job['description'] ?? ''), $exclusions)) continue;
    $filtered[] = $job;
    if (count($filtered) >= $limit) break;
}

echo json_encode(['jobs' => $filtered], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

function normalize_terms(mixed $value): array {
    if (is_array($value)) $raw = implode(',', array_map('strval', $value));
    else $raw = (string)$value;
    $parts = preg_split('/[,;\n]+/', $raw) ?: [];
    return array_values(array_filter(array_map(fn($p) => trim($p), $parts), fn($p) => $p !== ''));
}

function contains_exclusion(string $text, array $exclusions): bool {
    $haystack = strtolower($text);
    foreach ($exclusions as $term) {
        if ($term !== '' && str_contains($haystack, strtolower($term))) return true;
    }
    return false;
}

function fetch_url(string $url, string $accept = '*/*'): string {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 12,
            'header' => [
                'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
                'Accept: ' . $accept,
                'Accept-Language: en-US,en;q=0.9',
                'Referer: https://www.google.com/'
            ]
        ]
    ]);
    $data = @file_get_contents($url, false, $context);
    return is_string($data) ? $data : '';
}

function clean_text(string $value): string {
    $value = html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/', ' ', $value) ?? '');
}

function scrape_linkedin(string $keyword, string $location): array {
    $url = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search'
        . '?keywords=' . rawurlencode($keyword)
        . '&location=' . rawurlencode($location ?: 'Remote')
        . '&start=0';
    $html = fetch_url($url, 'text/html,*/*');
    if ($html === '') return [];

    preg_match_all('/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^?"]+)/', $html, $urlMatches);
    preg_match_all('/base-search-card__title[^>]*>\s*([^<]+)/s', $html, $titleMatches);
    preg_match_all('/base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+)/s', $html, $companyMatches);
    preg_match_all('/job-search-card__location[^>]*>\s*([^<]+)/s', $html, $locationMatches);

    $jobs = [];
    foreach (($urlMatches[1] ?? []) as $i => $jobUrl) {
        $title = clean_text($titleMatches[1][$i] ?? '');
        if ($title === '') $title = 'LinkedIn job match';
        $jobs[] = [
            'title' => $title,
            'company' => clean_text($companyMatches[1][$i] ?? 'Unknown'),
            'location' => clean_text($locationMatches[1][$i] ?? $location),
            'platform' => 'LinkedIn',
            'url' => strtok($jobUrl, '?'),
            'description' => ''
        ];
    }
    return $jobs;
}

function scrape_indeed(string $keyword, string $location): array {
    $url = 'https://www.indeed.com/rss?q=' . rawurlencode($keyword)
        . '&l=' . rawurlencode($location ?: 'Remote')
        . '&sort=date';
    $xml = fetch_url($url, 'application/rss+xml,application/xml,text/xml,*/*');
    if ($xml === '') return [];

    $doc = @simplexml_load_string($xml);
    if (!$doc || !isset($doc->channel->item)) return [];

    $jobs = [];
    foreach ($doc->channel->item as $item) {
        $titleRaw = clean_text((string)$item->title);
        $parts = explode(' - ', $titleRaw, 2);
        $company = trim($parts[1] ?? (string)$item->source);
        if ($company === '') $company = 'Unknown';
        $jobs[] = [
            'title' => trim($parts[0] ?? $titleRaw),
            'company' => $company,
            'location' => $location,
            'platform' => 'Indeed',
            'url' => (string)$item->link,
            'description' => clean_text((string)$item->description)
        ];
    }
    return $jobs;
}

function scrape_wuzzuf(string $keyword, string $location): array {
    $url = 'https://wuzzuf.net/api/v1/jobs/search?q=' . rawurlencode($keyword)
        . '&start=0&size=20';
    if ($location !== '') $url .= '&filters[city][0]=' . rawurlencode($location);
    $json = fetch_url($url, 'application/json,*/*');
    if ($json === '') return [];

    $root = json_decode($json, true);
    if (!is_array($root)) return [];
    $data = $root['data'] ?? $root['jobs'] ?? $root['results'] ?? [];
    if (!is_array($data)) return [];

    $jobs = [];
    foreach ($data as $item) {
        if (!is_array($item)) continue;
        $attr = is_array($item['attributes'] ?? null) ? $item['attributes'] : [];
        $title = (string)($item['title'] ?? $attr['title'] ?? '');
        $slug = (string)($item['slug'] ?? $item['id'] ?? $attr['slug'] ?? '');
        if ($title === '' || $slug === '') continue;
        $company = $item['company']['name'] ?? $attr['company'] ?? 'Unknown';
        $loc = $item['location']['name'] ?? $attr['location'] ?? $location;
        $jobs[] = [
            'title' => clean_text($title),
            'company' => clean_text((string)$company),
            'location' => clean_text((string)$loc),
            'platform' => 'Wuzzuf',
            'url' => str_starts_with($slug, 'http') ? $slug : 'https://wuzzuf.net/jobs/p/' . $slug,
            'description' => clean_text((string)($item['description'] ?? $attr['description'] ?? ''))
        ];
    }
    return $jobs;
}
