package com.example.demo.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import com.example.demo.model.ChatMessage;
import com.example.demo.model.ChatMessage.MessageType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Controller
public class WSController {

    private static final Logger logger = LoggerFactory.getLogger(WSController.class);

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.register")
    public void register(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) {
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        headerAccessor.getSessionAttributes().put("publicKey", chatMessage.getPublicKey());

        logger.info("User registered: {} with public key: {}", chatMessage.getSender(), chatMessage.getPublicKey());
        logger.info("Step 3: Publishing P and alpha (implicit in the curve parameters).");

        // Broadcast a message indicating that the user has joined
        ChatMessage joinMessage = new ChatMessage();
        joinMessage.setType(MessageType.JOIN);
        joinMessage.setSender(chatMessage.getSender());
        joinMessage.setPublicKey(chatMessage.getPublicKey());

        logger.info("Step 6: Sending own public key over an insecure channel.");
        logger.info("Broadcasting join message: {}", joinMessage);
        messagingTemplate.convertAndSend("/topic/public", joinMessage);
    }

    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessage chatMessage) {
        // Ensure the chat message has all necessary fields before broadcasting
        if (chatMessage.getEncryptedMessage() != null && chatMessage.getIv() != null) {
            logger.info("Broadcasting chat message: {}", chatMessage);
            messagingTemplate.convertAndSend("/topic/public", chatMessage);
        } else {
            logger.error("Incomplete chat message received: {}", chatMessage);
        }
    }
}
