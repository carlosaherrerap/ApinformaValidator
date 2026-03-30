const bcrypt = require('bcrypt');

// Charsets separados para garantizar variedad
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALL = LOWER + UPPER + DIGITS;

/**
 * Genera un token que SIEMPRE contiene al menos:
 * - 1 minúscula
 * - 1 mayúscula  
 * - 1 número
 * El resto se llena aleatoriamente y se mezcla (shuffle).
 */
const generateToken = (length) => {
    const len = length || parseInt(process.env.TOKEN_LENGTH) || 4;
    const chars = [];

    // Garantizar al menos 1 de cada tipo
    chars.push(LOWER.charAt(Math.floor(Math.random() * LOWER.length)));
    chars.push(UPPER.charAt(Math.floor(Math.random() * UPPER.length)));
    chars.push(DIGITS.charAt(Math.floor(Math.random() * DIGITS.length)));

    // Rellenar el resto con caracteres aleatorios del charset completo
    for (let i = chars.length; i < len; i++) {
        chars.push(ALL.charAt(Math.floor(Math.random() * ALL.length)));
    }

    // Mezclar (Fisher-Yates shuffle) para que no sea predecible
    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
};

const hashToken = async (token) => {
    return await bcrypt.hash(token, 8);
};

const compareToken = async (plain, hash) => {
    return await bcrypt.compare(plain, hash);
};

module.exports = { generateToken, hashToken, compareToken };

