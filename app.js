const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { generatePrimeSync, modPow } = require('bigint-crypto-utils');
const forge = require('node-forge');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the 'src/main/resources/static' directory
app.use(express.static('src/main/resources/static'));

const G = 5n;
const P = generatePrimeSync(512); // A large prime number

io.on('connection', (socket) => {
    console.log('a user connected');

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on('join', (data) => {
        const aliceRandomKey = generateRandomKey();
        const aliceSharedKey = modPow(G, aliceRandomKey, P);

        socket.emit('keyExchange', { aliceSharedKey: aliceSharedKey.toString(), P: P.toString(), G: G.toString() });

        socket.on('bobKey', (bobSharedKey) => {
            const bobSharedKeyBigInt = BigInt(bobSharedKey);
            const aliceSecretKey = modPow(bobSharedKeyBigInt, aliceRandomKey, P);
            socket.secretKey = aliceSecretKey;
        });

        socket.on('message', (data) => {
            if (socket.secretKey) {
                const decryptedMessage = decrypt(data.encryptedMessage, socket.secretKey.toString());
                console.log('Decrypted message:', decryptedMessage);
            } else {
                console.error('Secret key not set for socket.');
            }
        });
    });
});

function generateRandomKey() {
    return BigInt(forge.util.bytesToHex(forge.random.getBytesSync(64)), 16);
}

function encrypt(plainText, secretKey) {
    const key = forge.util.createBuffer(secretKey, 'utf8').getBytes(16);
    const cipher = forge.cipher.createCipher('AES-ECB', key);
    cipher.start();
    cipher.update(forge.util.createBuffer(plainText, 'utf8'));
    cipher.finish();
    return cipher.output.getBytes();
}

function decrypt(encryptedText, secretKey) {
    const key = forge.util.createBuffer(secretKey, 'utf8').getBytes(16);
    const decipher = forge.cipher.createDecipher('AES-ECB', key);
    decipher.start();
    decipher.update(forge.util.createBuffer(encryptedText));
    decipher.finish();
    return decipher.output.toString('utf8');
}

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
