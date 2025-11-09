import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";

const db = await getDB(DB_NAME);

const getAdminInfo = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    const result = await db.collection("admin").find({ uid }).toArray();

    const updatedResult = await Promise.all(
      result.map(async (admin) => {
        if (admin.schoolId) {
          // Fetch school details using schoolid
          const school = await db.collection("schools").findOne({
            id: admin.schoolId,
          });

          return {
            ...admin,
            school: school
              ? {
                  name: school.name,
                }
              : null,
          };
        }
        return {
          ...admin,
          school: null,
        };
      })
    );
    res.json({
      success: true,
      count: updatedResult.length,
      data: updatedResult,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { uid, updates } = req.body;

    if (!uid || !updates) {
      return res.status(400).json({ error: "Missing uid or updates" });
    }

    const result = await db
      .collection("admin")
      .findOneAndUpdate(
        { uid: uid },
        { $set: updates },
        { returnDocument: "after" }
      );

    console.log(result);

    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: result.value });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

export { getAdminInfo, updateProfile };
