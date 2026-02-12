/**
 * Genera un código de 4 caracteres alfanuméricos (sin "Ñ", espacios, etc.)
 * según el requisito del usuario.
 */
const generateToken = () => {
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Evitamos O, 0 por confusión visual
    let token = '';
    for (let i = 0; i < 4; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

module.exports = {
    generateToken
};
