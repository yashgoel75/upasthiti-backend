import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
    // Option 1: Using service account JSON file (recommended for production)
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
        });
    } catch (error) {
        console.log("Firebase Admin error:", error)
    }
}

export default admin;