/**
 * Transfer Note Utility
 * Creates and parses Veilon transfer notes for private transfers
 * Format: veilon://transfer?v=1&a=0.1&s=0x...&n=0x...&r=0x...&c=0x...
 */

export interface TransferNoteData {
  version: string;
  amount: string;
  secret: string;
  nullifier: string;
  randomness: string;
  commitment: string;
  token?: string;
}

export interface ParsedTransferNote {
  isValid: boolean;
  data?: TransferNoteData;
  error?: string;
}

/**
 * Generate a transfer note from commitment data
 */
export function generateTransferNote(data: {
  amount: string;
  secret: string;
  nullifier: string;
  randomness: string;
  commitment: string;
  token?: string;
}): string {
  const params = new URLSearchParams({
    v: '1', // Version
    a: data.amount,
    s: data.secret,
    n: data.nullifier,
    r: data.randomness,
    c: data.commitment,
  });

  if (data.token) {
    params.append('t', data.token);
  }

  return `veilon://transfer?${params.toString()}`;
}

/**
 * Parse a transfer note string
 */
export function parseTransferNote(note: string): ParsedTransferNote {
  try {
    // Validate basic format
    if (!note.startsWith('veilon://transfer?')) {
      return {
        isValid: false,
        error: 'Invalid note format. Must start with veilon://transfer?',
      };
    }

    // Extract query parameters
    const urlParts = note.split('?');
    if (urlParts.length !== 2) {
      return {
        isValid: false,
        error: 'Invalid note structure',
      };
    }

    const params = new URLSearchParams(urlParts[1]);

    // Extract all required fields
    const version = params.get('v');
    const amount = params.get('a');
    const secret = params.get('s');
    const nullifier = params.get('n');
    const randomness = params.get('r');
    const commitment = params.get('c');
    const token = params.get('t') || 'ETH';

    // Validate required fields exist
    if (!version || !amount || !secret || !nullifier || !randomness || !commitment) {
      return {
        isValid: false,
        error: 'Missing required fields in transfer note',
      };
    }

    // Validate version
    if (version !== '1') {
      return {
        isValid: false,
        error: `Unsupported note version: ${version}`,
      };
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return {
        isValid: false,
        error: 'Invalid amount in transfer note',
      };
    }

    // No validation needed for hex format - secrets can be plain numbers or hex strings

    return {
      isValid: true,
      data: {
        version,
        amount,
        secret,
        nullifier,
        randomness,
        commitment,
        token,
      },
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Failed to parse transfer note',
    };
  }
}

/**
 * Validate a transfer note
 */
export function validateTransferNote(note: string): boolean {
  const parsed = parseTransferNote(note);
  return parsed.isValid;
}

/**
 * Format transfer note for display (truncated)
 */
export function formatTransferNoteForDisplay(note: string, maxLength: number = 50): string {
  if (note.length <= maxLength) {
    return note;
  }

  const start = note.substring(0, maxLength / 2);
  const end = note.substring(note.length - maxLength / 2);
  return `${start}...${end}`;
}

/**
 * Extract amount from transfer note without full parsing
 */
export function getAmountFromNote(note: string): string | null {
  try {
    const urlParts = note.split('?');
    if (urlParts.length !== 2) return null;

    const params = new URLSearchParams(urlParts[1]);
    return params.get('a');
  } catch {
    return null;
  }
}

/**
 * Get token from transfer note
 */
export function getTokenFromNote(note: string): string {
  try {
    const urlParts = note.split('?');
    if (urlParts.length !== 2) return 'ETH';

    const params = new URLSearchParams(urlParts[1]);
    return params.get('t') || 'ETH';
  } catch {
    return 'ETH';
  }
}
