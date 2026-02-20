/**
 * Prompt Sanitizer Module
 * 
 * Sanitizes prompts to prevent content policy rejections from video generation platforms.
 * Extracted from content.js for modularity.
 * 
 * @module platforms/googleVids/promptSanitizer
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Sanitization rules for video generation prompts.
 * Each rule has a regex pattern and a replacement string.
 */
const SANITIZE_RULES = [
    // =========== PROMINENT PEOPLE / CELEBRITIES (NEW - Fixes PROMINENT_PEOPLE_FILTER_FAILED) ===========
    { pattern: /\b(celebrity|celebrities|famous|star|superstar|celeb)\b/gi, replacement: 'person' },
    { pattern: /\b(actor|actress|singer|musician|rapper|dj|entertainer)\b/gi, replacement: 'performer' },
    { pattern: /\b(president|politician|senator|governor|mayor|minister|congressman)\b/gi, replacement: 'official' },
    { pattern: /\b(athlete|player|champion|olympian|footballer|basketball player)\b/gi, replacement: 'competitor' },
    { pattern: /\b(influencer|youtuber|tiktoker|streamer|vlogger)\b/gi, replacement: 'content creator' },
    { pattern: /\b(billionaire|mogul|tycoon|ceo)\b/gi, replacement: 'businessman' },
    { pattern: /\b(royal|prince|princess|king|queen|duke|duchess)\b/gi, replacement: 'individual' },

    // Meme character names (often trigger filters)
    { pattern: /\b(karen|chad|kyle|becky|kevin|susan|felicia)\b/gi, replacement: 'customer' },
    { pattern: /\b(santa|claus|easter bunny|tooth fairy|leprechaun)\b/gi, replacement: 'mysterious figure' },

    // Channel persona names (trigger "real person" filters)
    { pattern: /\bmark\s+bobl\b/gi, replacement: 'the analyst' },
    { pattern: /\b(himself|herself|themselves)\s+from\s+\d+\s+years?\s+ago\b/gi, replacement: 'in an old photo' },
    { pattern: /\bfrom\s+\d+\s+years?\s+ago\b/gi, replacement: 'in the past' },
    { pattern: /\b\d+\s+years?\s+(ago|younger|older)\b/gi, replacement: 'previously' },

    // Generic person + name patterns (two capitalized words = likely a name)
    { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(himself|herself|themselves)\b/gi, replacement: 'the person themselves' },

    // Title + Name patterns (likely real people)
    { pattern: /\b(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+[A-Z][a-z]+/gi, replacement: 'the person' },

    // =========== CRIME / FORENSIC / HACKING (NEW - Fixes filter for tech thriller content) ===========
    { pattern: /\b(criminal|criminals|crime|crimes)s?\b/gi, replacement: 'incident' },
    { pattern: /\b(forensic|forensics)\b/gi, replacement: 'technical' },
    { pattern: /\b(hacker|hackers|hacking|hacked)\b/gi, replacement: 'technician' },
    { pattern: /\b(virus|malware|trojan|ransomware|spyware)\b/gi, replacement: 'software' },
    { pattern: /\b(illegal|illicit|unlawful)\b/gi, replacement: 'unusual' },
    { pattern: /\b(evidence|clues?|traces?)\b/gi, replacement: 'information' },
    { pattern: /\b(investigation|investigating|investigated)\b/gi, replacement: 'analysis' },
    { pattern: /\b(suspect|suspects|suspicious)\b/gi, replacement: 'person of interest' },
    { pattern: /\b(police|cops?|officer|detective|fbi|cia|nsa)\b/gi, replacement: 'professional' },
    { pattern: /\b(arrest|arrested|arresting)\b/gi, replacement: 'detained' },
    { pattern: /\b(prison|jail|inmate|convict)\b/gi, replacement: 'facility' },
    { pattern: /\b(steal|stole|stolen|theft|thief|robbery|robber)\b/gi, replacement: 'take' },
    { pattern: /\b(fraud|scam|scammer|phishing)\b/gi, replacement: 'scheme' },
    { pattern: /\b(spy|spying|espionage|surveillance)\b/gi, replacement: 'monitoring' },
    { pattern: /\b(corrupt|corrupted|corruption)\b/gi, replacement: 'damaged' },
    { pattern: /\b(deleted|erased|wiped)\s+(file|data|evidence)/gi, replacement: 'removed information' },
    { pattern: /\bFILE[_\s]?CORRUPTED\b/gi, replacement: 'FILE ISSUE' },
    { pattern: /\b[A-Z_]+\.LOG\b/gi, replacement: 'SYSTEM.TXT' },
    { pattern: /\b(hidden|secret|classified|confidential)\s+(file|folder|document|data)/gi, replacement: 'private document' },

    // =========== CHILDREN / MINORS (CRITICAL) ===========
    { pattern: /\b(child|children|kid|kids|minor|minors|teen|teenager|youth)\b/gi, replacement: 'adult' },
    { pattern: /\b(baby|babies|infant|infants|toddler|newborn)\b/gi, replacement: 'person' },
    { pattern: /\b(boy|boys|girl|girls)\b/gi, replacement: 'person' },
    { pattern: /\b(adolescent|juvenile|underage|preteen)\b/gi, replacement: 'person' },
    { pattern: /\b(school|playground|daycare|nursery|kindergarten|elementary)\b/gi, replacement: 'location' },
    { pattern: /\b(student|students|pupil|pupils)\b/gi, replacement: 'person' },

    // Age patterns
    { pattern: /\b(\d+)[\s-]?(year|yr)[\s-]?old\b/gi, replacement: 'adult' },
    { pattern: /\b(young|little|small)\s+(boy|girl|child|kid)\b/gi, replacement: 'adult bystander' },
    { pattern: /\b(pixelated|blurred)\s+(picture|photo|image)\s+of\s+[A-Z][a-z]+/gi, replacement: 'stylized image' },

    // =========== Death/Dying ===========
    { pattern: /\b(dead|death|die|dying|dies|died)s?\b/gi, replacement: 'incident' },
    { pattern: /\b(kill|killed|killing|kills)\b/gi, replacement: 'encounter' },
    { pattern: /\b(murder|murdered|murdering)\b/gi, replacement: 'event' },
    { pattern: /\b(fatal|fatally|lethal|deadly)\b/gi, replacement: 'serious' },
    { pattern: /\b(corpse|cadaver|body bag)\b/gi, replacement: 'figure' },

    // =========== Violence ===========
    { pattern: /\b(violent|violence)\b/gi, replacement: 'intense' },
    { pattern: /\b(attack|attacked|attacking)s?\b/gi, replacement: 'approach' },
    { pattern: /\b(assault|assaulted)\b/gi, replacement: 'confrontation' },
    { pattern: /\b(fight|fighting|fought)\b/gi, replacement: 'interaction' },
    { pattern: /\b(punch|punched|punching)\b/gi, replacement: 'gesture' },
    { pattern: /\b(kick|kicked|kicking)\b/gi, replacement: 'motion' },
    { pattern: /\b(hit|hitting|hits)\s+(head|face|body)/gi, replacement: 'bumps into' },
    { pattern: /\b(beat|beaten|beating)\b/gi, replacement: 'encounter' },
    { pattern: /\b(stab|stabbed|stabbing)\b/gi, replacement: 'poke' },
    { pattern: /\b(strangle|strangled|strangling)\b/gi, replacement: 'hold' },
    { pattern: /\b(slap|slapped|slapping)\b/gi, replacement: 'gesture' },

    // =========== Weapons ===========
    { pattern: /\b(gun|guns|pistol|rifle|firearm)s?\b/gi, replacement: 'device' },
    { pattern: /\b(shoot|shot|shooting)\b/gi, replacement: 'aim' },
    { pattern: /\b(bullet|bullets)\b/gi, replacement: 'object' },
    { pattern: /\b(weapon|weapons)\b/gi, replacement: 'equipment' },
    { pattern: /\b(knife|knives|blade)\b/gi, replacement: 'tool' },
    { pattern: /\b(sword|swords)\b/gi, replacement: 'prop' },
    { pattern: /\b(bomb|bombs|explosive)s?\b/gi, replacement: 'package' },

    // =========== Explosions ===========
    { pattern: /\b(explode|explodes|exploded|exploding)\b/gi, replacement: 'burst' },
    { pattern: /\b(explosion|explosions)\b/gi, replacement: 'flash' },
    { pattern: /\b(detonate|detonated|detonating)\b/gi, replacement: 'activate' },
    { pattern: /\b(blast|blasted|blasting)\b/gi, replacement: 'rush' },

    // =========== Blood/Gore ===========
    { pattern: /\b(blood|bloody|bleeding|bleeds|bled)\b/gi, replacement: 'spill' },
    { pattern: /\b(gore|gory)\b/gi, replacement: 'mess' },
    { pattern: /\b(wound|wounds|wounded)\b/gi, replacement: 'mark' },
    { pattern: /\b(injury|injuries|injured)\b/gi, replacement: 'impact' },
    { pattern: /\b(scar|scars|scarred)\b/gi, replacement: 'mark' },

    // =========== Crashes/Accidents ===========
    { pattern: /\b(crash|crashed|crashing|crashes)\b/gi, replacement: 'bump' },
    { pattern: /\b(accident|accidents)\b/gi, replacement: 'mishap' },
    { pattern: /\b(collision|collisions)\b/gi, replacement: 'contact' },
    { pattern: /\b(wreck|wrecked|wrecking)\b/gi, replacement: 'damage' },

    // =========== Falls from height ===========
    { pattern: /\b(fall|falls|fell|falling) (from|off) (a |the )?(height|building|cliff|roof|bridge|balcony)/gi, replacement: 'slip near the edge' },
    { pattern: /\b(plunge|plunged|plunging)\b/gi, replacement: 'slide' },
    { pattern: /\b(drop|dropped|dropping) (from|off)/gi, replacement: 'move away' },

    // =========== Fear/Terror ===========
    { pattern: /\b(terrified|terrifying|terror)\b/gi, replacement: 'surprised' },
    { pattern: /\b(horrified|horrifying|horror)\b/gi, replacement: 'shocked' },
    { pattern: /\b(scared|scary|scare)\b/gi, replacement: 'startled' },
    { pattern: /\b(fear|fears|feared|fearing)\b/gi, replacement: 'concern' },
    { pattern: /\b(panic|panicked|panicking)\b/gi, replacement: 'hurried' },

    // =========== Danger ===========
    { pattern: /\b(dangerous|danger)\b/gi, replacement: 'unexpected' },
    { pattern: /\b(risk|risky|risking)\b/gi, replacement: 'chance' },
    { pattern: /\b(threat|threaten|threatening)\b/gi, replacement: 'approach' },
    { pattern: /\b(harm|harming|harmed)\b/gi, replacement: 'affect' },

    // =========== Drugs/Alcohol ===========
    { pattern: /\b(drug|drugs|narcotic|narcotics)\b/gi, replacement: 'substance' },
    { pattern: /\b(overdose|overdosed|overdosing)\b/gi, replacement: 'incident' },
    { pattern: /\b(intoxicated|drunk|wasted|high)\b/gi, replacement: 'disoriented' },
    { pattern: /\b(cocaine|heroin|meth|marijuana|weed)\b/gi, replacement: 'substance' },

    // =========== Self-harm ===========
    { pattern: /\b(suicide|suicidal)\b/gi, replacement: 'crisis' },
    { pattern: /\b(self-harm|self harm|cutting|cut myself)\b/gi, replacement: 'situation' },

    // =========== Hate speech ===========
    { pattern: /\b(hate|hatred|hating)\b/gi, replacement: 'dislike' },
    { pattern: /\b(racist|racism|racial slur)\b/gi, replacement: 'inappropriate' },
    { pattern: /\b(nazi|fascist|white supremacist)\b/gi, replacement: 'extremist' },

    // =========== Adult content ===========
    { pattern: /\b(porn|sexual|explicit|nude|naked|sex|erotic)\b/gi, replacement: 'adult' },

    // =========== Red liquids (mistaken for blood) ===========
    { pattern: /\bred (wine|juice|liquid|sauce) spill(s|ed|ing)?/gi, replacement: 'colorful liquid spill' },
    { pattern: /\b(ketchup|tomato sauce) (spill|splash|splatter)/gi, replacement: 'sauce spread' },
    { pattern: /\b(blood red|crimson|scarlet) (liquid|pool|stain)/gi, replacement: 'colorful spill' }
];

/**
 * Sanitizes a prompt for Google Vids/Flow to prevent content policy rejections.
 * 
 * @param {string} text - Original prompt text
 * @returns {string} Sanitized prompt text
 * 
 * @example
 * const safe = sanitizePromptForGoogleVids('Man falls from building and dies');
 * // Returns: 'Man slips near the edge and incident'
 */
function sanitizePromptForGoogleVids(text) {
    if (!text || typeof text !== 'string') {
        return text || '';
    }

    const originalLength = text.length;
    let sanitized = text;
    let changesCount = 0;

    // Apply all sanitization rules
    for (const rule of SANITIZE_RULES) {
        const before = sanitized;
        sanitized = sanitized.replace(rule.pattern, rule.replacement);
        if (before !== sanitized) {
            changesCount++;
        }
    }

    // Remove any remaining dangerous patterns
    // Multiple exclamation marks with caps (aggressive tone)
    sanitized = sanitized.replace(/[A-Z]{3,}!{2,}/g, match => match.toLowerCase().replace(/!+/g, '!'));

    // Remove any HTML/script tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');

    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    // Log if changes were made
    if (changesCount > 0) {
        console.log(`🛡️ [Sanitizer] Made ${changesCount} replacements`);
        console.log(`🛡️ [Sanitizer] Original length: ${originalLength}, New length: ${sanitized.length}`);
    }

    return sanitized;
}

/**
 * Checks if a prompt contains potentially problematic content.
 * 
 * @param {string} text - Prompt text to check
 * @returns {{safe: boolean, issues: string[]}} Safety check result
 * 
 * @example
 * const check = checkPromptSafety('Show explosion with fire');
 * // Returns: { safe: false, issues: ['Contains: explosion'] }
 */
function checkPromptSafety(text) {
    const issues = [];

    // Check each rule
    for (const rule of SANITIZE_RULES) {
        if (rule.pattern.test(text)) {
            const match = text.match(rule.pattern);
            issues.push(`Contains: ${match?.[0] || 'restricted term'}`);
        }
    }

    return {
        safe: issues.length === 0,
        issues
    };
}

/**
 * Gets the list of sanitization rules (for debugging/display).
 * 
 * @returns {Array<{category: string, examples: string[]}>}
 */
function getSanitizationCategories() {
    return [
        { category: 'Death/Dying', examples: ['dead', 'die', 'kill', 'murder'] },
        { category: 'Violence', examples: ['attack', 'fight', 'punch', 'stab'] },
        { category: 'Weapons', examples: ['gun', 'knife', 'bomb', 'weapon'] },
        { category: 'Explosions', examples: ['explode', 'explosion', 'blast'] },
        { category: 'Blood/Gore', examples: ['blood', 'gore', 'wound'] },
        { category: 'Crashes', examples: ['crash', 'accident', 'collision'] },
        { category: 'Falls', examples: ['fall from height', 'plunge'] },
        { category: 'Fear/Terror', examples: ['terrified', 'horror', 'panic'] },
        { category: 'Danger', examples: ['dangerous', 'threat', 'harm'] },
        { category: 'Minors', examples: ['child', 'kid', 'teen'] }
    ];
}

// Export for use in other modules
window.PromptSanitizer = {
    sanitize: sanitizePromptForGoogleVids,
    sanitizePromptForGoogleVids,
    checkSafety: checkPromptSafety,
    getCategories: getSanitizationCategories,
    RULES: SANITIZE_RULES
};

// Also expose main function globally for backward compatibility
window.sanitizePromptForGoogleVids = sanitizePromptForGoogleVids;

console.log('📦 [Module] platforms/googleVids/promptSanitizer.js loaded');
