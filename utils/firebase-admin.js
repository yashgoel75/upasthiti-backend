import admin from "firebase-admin";

let facultyAdmin;
let studentAdmin;

if (!admin.apps.length) {
  try {
    facultyAdmin = admin.initializeApp(
      {
        credential: admin.credential.cert({
          project_id: process.env.FIREBASE_PROJECT_ID_FACULTY,
          client_email: process.env.FIREBASE_CLIENT_EMAIL_FACULTY,
          private_key: process.env.FIREBASE_PRIVATE_KEY_FACULTY?.replace(
            /\\n/g,
            "\n"
          ),
        }),
      },
      "faculty"
    );
    studentAdmin = admin.initializeApp(
      {
        credential: admin.credential.cert({
          project_id: process.env.FIREBASE_PROJECT_ID_STUDENT,
          client_email: process.env.FIREBASE_CLIENT_EMAIL_STUDENT,
          private_key: process.env.FIREBASE_PRIVATE_KEY_STUDENT?.replace(
            /\\n/g,
            "\n"
          ),
        }),
      },
      "student"
    );
  } catch (error) {
    console.log("Firebase Admin error:", error);
  }
}

export { facultyAdmin, studentAdmin };
