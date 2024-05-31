package com.example.demo.utils;

import javax.crypto.KeyAgreement;
import java.security.PrivateKey;
import java.security.PublicKey;

public class KeyAgreementUtil {

    public static byte[] computeSharedSecret(PrivateKey privateKey, PublicKey otherPublicKey) throws Exception {
        KeyAgreement keyAgreement = KeyAgreement.getInstance("ECDH");
        keyAgreement.init(privateKey);
        keyAgreement.doPhase(otherPublicKey, true);
        return keyAgreement.generateSecret();
    }
}
