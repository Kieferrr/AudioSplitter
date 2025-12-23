import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// 1. Inicializar Firebase Admin (Con la Llave Maestra)
// Leemos el JSON de forma segura
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    // Verificamos si ya está inicializada para no dar error
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("👮 Paywall: Sistema de cobros activo (Modo Admin).");
    }
} else {
    console.warn("⚠️ ADVERTENCIA: No se encontró 'serviceAccountKey.json'. El cobro de créditos fallará.");
}

const db = admin.firestore();

// 2. Middleware de Cobro
export const checkCreditBalance = async (req, res, next) => {
    try {
        // A. Buscar el token en la cabecera
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No autorizado. Falta token.' });
        }

        const token = authHeader.split('Bearer ')[1];

        // B. Verificar quién es el usuario
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // C. Consultar saldo en Firestore
        const userRef = db.collection('users').doc(uid);

        // Usamos una transacción para que el cobro sea ATÓMICO (seguro)
        // Esto evita que si el usuario hace 2 clics muy rápido, gaste los mismos 10 créditos
        await db.runTransaction(async (t) => {
            const doc = await t.get(userRef);

            if (!doc.exists) {
                throw new Error("USER_NOT_FOUND");
            }

            const userData = doc.data();
            const currentCredits = userData.credits || 0;
            const COST = 10; // Precio por canción

            // D. ¿Tiene saldo suficiente?
            if (currentCredits < COST) {
                throw new Error("INSUFFICIENT_FUNDS");
            }

            // E. Cobrar
            const newBalance = currentCredits - COST;
            t.update(userRef, { credits: newBalance });

            // Inyectamos el usuario en la request por si lo necesitamos luego
            req.user = { uid, email: decodedToken.email, newBalance };
        });

        // Si todo salió bien, dejamos pasar a la siguiente función (el upload)
        next();

    } catch (error) {
        console.error("Error en Paywall:", error.message);

        if (error.message === 'INSUFFICIENT_FUNDS') {
            return res.status(403).json({
                error: 'Saldo insuficiente',
                message: 'No tienes suficientes créditos (requerido: 10). Recarga o espera.'
            });
        }

        if (error.code === 'auth/argument-error') {
            return res.status(401).json({ error: 'Token inválido o expirado.' });
        }

        return res.status(500).json({ error: 'Error procesando el pago de créditos.' });
    }
};