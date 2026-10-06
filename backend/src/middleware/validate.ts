import type { Request, Response, NextFunction } from 'express';

// ─── SSRF blocklist ───────────────────────────────────────────────────────────
const SSRF_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\.0\.0\.0/,
  /^169\.254\./,           // link-local
  /^metadata\.google/i,    // GCP metadata
  /^169\.254\.169\.254/,   // AWS/GCP metadata IP
];

// ─── Normalizers ──────────────────────────────────────────────────────────────

export function normalizePhone(raw: string): string {
  // Strip spaces, dashes, parentheses, dots — keep + prefix and digits
  return raw.replace(/[\s\-().]/g, '');
}

function isValidPhone(normalized: string): boolean {
  const digits = normalized.replace(/^\+/, '');
  return /^\d{7,15}$/.test(digits);
}

function isValidEmail(input: string): boolean {
  // RFC 5321 simplified — local@domain.tld
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input) && input.length <= 320;
}

function sanitizeBusiness(input: string): string {
  // Strip SQL/HTML injection characters
  return input.replace(/[<>'"`;\\]/g, '').slice(0, 200).trim();
}

function isSsrf(input: string): boolean {
  const lower = input.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  return SSRF_PATTERNS.some((p) => p.test(lower));
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export function validateInput(req: Request, res: Response, next: NextFunction) {
  const body = (req.body ?? {}) as { input?: string; inputType?: string };
  const { input, inputType } = body;

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'input is required' });
  }

  const trimmed = input.trim();

  // SSRF guard (applies to all types)
  if (isSsrf(trimmed)) {
    return res.status(400).json({ error: 'Invalid input: internal addresses are not allowed' });
  }

  // Type-specific validation
  const type = inputType ?? 'phone';

  if (type === 'phone') {
    const normalized = normalizePhone(trimmed);
    if (!isValidPhone(normalized)) {
      return res.status(400).json({ error: 'Invalid phone number: must be 7–15 digits (E.164 compatible)' });
    }
    body.input = normalized;
  } else if (type === 'email') {
    if (!isValidEmail(trimmed)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    body.input = trimmed.toLowerCase();
  } else if (type === 'business' || type === 'name') {
    const cleaned = sanitizeBusiness(trimmed);
    if (cleaned.length < 2) {
      return res.status(400).json({ error: 'Input too short after sanitization' });
    }
    body.input = cleaned;
  }

  next();
}
