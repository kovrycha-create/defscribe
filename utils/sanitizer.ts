export class Sanitizer {
    private static escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;',
        };
        return text.replace(/[&<>"'/]/g, char => map[char]);
    }
    
    static sanitizeTranscript(text: string): string {
        // Remove any script tags or dangerous content
        let cleaned = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        cleaned = cleaned.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
        cleaned = cleaned.replace(/on\w+\s*=\s*'[^']*'/gi, '');
        cleaned = this.escapeHtml(cleaned);
        return cleaned;
    }
    
    static sanitizeForDisplay(text: string): string {
        // Allow only safe HTML tags for formatting
        const allowedTags = ['b', 'i', 'em', 'strong', 'u', 'br'];
        let sanitized = this.escapeHtml(text);
        
        // Re-enable allowed tags
        allowedTags.forEach(tag => {
            const regex = new RegExp(`&lt;(${tag})&gt;`, 'gi');
            sanitized = sanitized.replace(regex, '<$1>');
            const closeRegex = new RegExp(`&lt;/(${tag})&gt;`, 'gi');
            sanitized = sanitized.replace(closeRegex, '</$1>');
        });
        
        return sanitized;
    }
}
