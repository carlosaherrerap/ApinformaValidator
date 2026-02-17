const bcrypt = require('bcrypt');

// Charset: minúsculas, mayúsculas, números. Sin ñ/Ñ, tildes, símbolos.
// Eliminamos O/0, l/1/I para evitar confusión visual.
const CHARSET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Genera un token alfanumérico de longitud configurable.
 * @param {number} length - Longitud del token (default: TOKEN_LENGTH del .env o 4)
 * @returns {string} Token generado
 */
const generateToken = (length) => {
    const len = length || parseInt(process.env.TOKEN_LENGTH) || 4;
    let token = '';
    for (let i = 0; i < len; i++) {
        token += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
    return token;
};

/**
 * Genera el hash bcrypt de un token.
 * @param {string} token - Token en texto plano
 * @returns {Promise<string>} Hash bcrypt
 */
const hashToken = async (token) => {
    return await bcrypt.hash(token, 8);
};

/**
 * Compara un token en texto plano contra su hash.
 * @param {string} plain - Token ingresado por el usuario
 * @param {string} hash - Hash almacenado en DB
 * @returns {Promise<boolean>}
 */
const compareToken = async (plain, hash) => {
    return await bcrypt.compare(plain, hash);
};

module.exports = { generateToken, hashToken, compareToken };
