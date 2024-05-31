'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;
var currentUserPrivateKey = null;
var publicKeys = {}; // Store public keys of other users
var sharedSecrets = {}; // Store shared secrets with other users
var processedMessageIds = new Set(); // Track processed message IDs
var userColors = {}; // Store colors assigned to users

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function generateDHKeyPair() {
    console.log("Step 1: Implicitly choosing a large prime P");
    console.log("Step 2: Choosing generator alpha using curve P-256.");
    return window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256" // Step 1 & 2: Implicitly chooses a large prime P and a generator alpha
        },
        true,
        ["deriveKey", "deriveBits"]
    );
}

async function connect(event) {
    username = document.querySelector('#name').value.trim();

    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        var socket = new SockJS('/websocket');
        stompClient = Stomp.over(socket);

        stompClient.connect({}, async function () {
            console.log("Connected to WebSocket server.");
            const keyPair = await generateDHKeyPair();
            const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
            const publicKeyBase64 = arrayBufferToBase64(publicKey);

            console.log("Step 4: Generated ECDH key pair for user (private and public keys created): ", publicKeyBase64);

            onConnected(keyPair.privateKey, publicKeyBase64);
            connectingElement.classList.add('hidden');

        }, onError);
    }
    event.preventDefault();
}

async function onConnected(privateKey, publicKeyBase64) {
    stompClient.subscribe('/topic/public', async function (payload) {
        var message = JSON.parse(payload.body);

        // Check if message has already been processed
        if (processedMessageIds.has(message.messageId)) {
            return;
        }

        // Add message ID to processed set
        processedMessageIds.add(message.messageId);

        if (message.type === 'JOIN') {
            console.log(`Step 5: Handling join message from ${message.sender}`);
            handleJoinMessage(message);
        } else if (message.type === 'CHAT') {
            await handleChatMessage(message);
        }
    });

    console.log("Step 6: Sending own public key over an insecure channel.");
    stompClient.send("/app/chat.register",
        {},
        JSON.stringify({ sender: username, type: 'JOIN', publicKey: publicKeyBase64.replace(/\s+/g, '') })
    );

    currentUserPrivateKey = privateKey;
    connectingElement.classList.add('hidden');
}

async function handleJoinMessage(message) {
    var messageElement = document.createElement('li');
    messageElement.classList.add('event-message');
    messageElement.textContent = 'Welcome ' + message.sender + '!';
    messageArea.appendChild(messageElement);
    messageArea.scrollTop = messageArea.scrollHeight;

    if (message.publicKey) {
        try {
            console.log("Step 7: Received and imported public key from " + message.sender + ": " + message.publicKey);
            const otherUserPublicKey = await crypto.subtle.importKey(
                'spki',
                base64ToArrayBuffer(message.publicKey),
                { name: 'ECDH', namedCurve: 'P-256' },
                true,
                []
            );
            const sharedSecret = await computeSharedSecret(otherUserPublicKey);
            publicKeys[message.sender] = message.publicKey; // Store the public key
            sharedSecrets[message.sender] = sharedSecret;
            console.log("Step 8: Computed shared secret for " + message.sender);
        } catch (error) {
            console.error("Failed to compute shared secret:", error);
        }
    } else {
        console.error("Public key for " + message.sender + " is missing.");
    }
}

function onError(error) {
    console.error('WebSocket connection error:', error);
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}

async function computeSharedSecret(otherUserPublicKey) {
    try {
        console.log("Step 8: Computing shared secret...");
        const sharedSecretBits = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: otherUserPublicKey },
            currentUserPrivateKey,
            256
        );

        const sharedSecret = await crypto.subtle.importKey(
            'raw',
            sharedSecretBits,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );

        console.log('Shared secret derived successfully.');
        return sharedSecret;
    } catch (error) {
        console.error('Error deriving shared secret:', error);
        return null;
    }
}

async function decryptMessage(encryptedMessage, iv, sharedSecret) {
    try {
        console.log("Decrypting message using AES-GCM...");
        const decryptedMessage = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv // The IV must be unique for each encryption operation
            },
            sharedSecret,
            encryptedMessage
        );

        const decoder = new TextDecoder();
        const decodedMessage = decoder.decode(decryptedMessage);
        console.log("Decrypted message: ", decodedMessage);

        return decodedMessage;
    } catch (error) {
        console.error('Error decrypting message:', error.message);
        return null;
    }
}

async function encryptMessage(message, sharedSecret) {
    console.log("Encrypting message using AES-GCM...");
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);

    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Generating a random IV

    const encryptedMessage = await window.crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv // The IV must be unique for each encryption operation
        },
        sharedSecret,
        messageBuffer
    );

    console.log("Encrypted message: ", arrayBufferToBase64(encryptedMessage));

    return {
        encryptedMessage: arrayBufferToBase64(encryptedMessage),
        iv: arrayBufferToBase64(iv)
    };
}

function send(event) {
    event.preventDefault();
    const messageContent = messageInput.value.trim();

    if (messageContent && stompClient) {
        console.log('Encrypting message before sending:', messageContent);

        for (const recipient in sharedSecrets) {
            encryptMessage(messageContent, sharedSecrets[recipient])
                .then(function (encryptedMessage) {
                    console.log('Encrypted message:', encryptedMessage);

                    const chatMessage = {
                        sender: username,
                        encryptedMessage: encryptedMessage.encryptedMessage,
                        iv: encryptedMessage.iv,
                        type: 'CHAT',
                        rawMessage: messageContent, // Add raw message
                        messageId: `${Date.now()}-${Math.random()}` // Add unique ID for each message
                    };

                    stompClient.send("/app/chat.send", {}, JSON.stringify(chatMessage));
                    messageInput.value = '';
                })
                .catch(function (error) {
                    console.error('Failed to encrypt and send message:', error);
                });
        }
    }
}

async function handleChatMessage(message) {
    console.log('Handling chat message:', message);

    let displayContent = message.rawMessage || "Message decryption failed";

    if (message.encryptedMessage && message.iv && sharedSecrets[message.sender]) {
        try {
            const encryptedMessageArrayBuffer = base64ToArrayBuffer(message.encryptedMessage);
            const ivArrayBuffer = base64ToArrayBuffer(message.iv);

            const decryptedContent = await decryptMessage(
                encryptedMessageArrayBuffer,
                ivArrayBuffer,
                sharedSecrets[message.sender]
            );

            displayContent = decryptedContent || displayContent;

        } catch (error) {
            console.error('Error handling chat message:', error);
        }
    }

    if (displayContent) {
        const messageElement = document.createElement('li');
        messageElement.classList.add('chat-message');

        const avatarElement = document.createElement('i');
        const avatarText = document.createTextNode(message.sender[0]);
        avatarElement.appendChild(avatarText);
        avatarElement.style['background-color'] = getAvatarColor(message.sender);

        messageElement.appendChild(avatarElement);

        const usernameElement = document.createElement('span');
        const usernameText = document.createTextNode(message.sender);
        usernameElement.appendChild(usernameText);
        messageElement.appendChild(usernameElement);

        const textElement = document.createElement('p');
        const messageText = document.createTextNode(displayContent);
        textElement.appendChild(messageText);

        messageElement.appendChild(textElement);

        messageArea.appendChild(messageElement);
        messageArea.scrollTop = messageArea.scrollHeight;
    } else {
        console.error('Display content is empty.');
    }
}

function getAvatarColor(messageSender) {
    if (!userColors[messageSender]) {
        var hash = 0;
        for (var i = 0; i < messageSender.length; i++) {
            hash = 31 * hash + messageSender.charCodeAt(i);
        }
        var index = Math.abs(hash % colors.length);
        userColors[messageSender] = colors[index];
    }
    return userColors[messageSender];
}

usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', send, true);
