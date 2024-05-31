package com.example.demo.utils;

import javax.crypto.Cipher;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

public class DiffieHellmanHelper {
    private static final BigInteger G = new BigInteger("5");
    private static final BigInteger P = new BigInteger("23");

    public static BigInteger createRandomKey() {
        SecureRandom random = new SecureRandom();
        return new BigInteger(128, random);
    }

    public static BigInteger calculateSharedKey(BigInteger privateKey) {
        return G.modPow(privateKey, P);
    }

    public static BigInteger calculateSecretKey(BigInteger sharedKey, BigInteger privateKey) {
        return sharedKey.modPow(privateKey, P);
    }

    public static byte[] encrypt(String plainText, BigInteger secretKey) throws Exception {
        SecretKeySpec secretKeySpec = createSecretKeySpec(secretKey);
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec);
        return cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
    }

    public static String decrypt(byte[] encryptedData, BigInteger secretKey) throws Exception {
        SecretKeySpec secretKeySpec = createSecretKeySpec(secretKey);
        Cipher cipher = Cipher.getInstance("AES/ECB/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, secretKeySpec);
        byte[] decryptedBytes = cipher.doFinal(encryptedData);
        return new String(decryptedBytes, StandardCharsets.UTF_8);
    }

    private static SecretKeySpec createSecretKeySpec(BigInteger secretKey) {
        byte[] keyBytes = secretKey.toByteArray();
        byte[] validKeyBytes = new byte[16];
        System.arraycopy(keyBytes, 0, validKeyBytes, 0, Math.min(keyBytes.length, validKeyBytes.length));
        return new SecretKeySpec(validKeyBytes, "AES");
    }
}
