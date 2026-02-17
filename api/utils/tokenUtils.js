const bcrypt = require('bcrypt');

// Charset: minúsculas, mayúsculas, números
const CHARSET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';


const generateToken = (length) => {
    const len = length || parseInt(process.env.TOKEN_LENGTH) || 4;
    let token = '';
    for (let i = 0; i < len; i++) {
        token += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
    }
    return token;
};


const hashToken = async (token) => {
    return await bcrypt.hash(token, 8);
};

const compareToken = async (plain, hash) => {
    return await bcrypt.compare(plain, hash);
};

module.exports = { generateToken, hashToken, compareToken };
