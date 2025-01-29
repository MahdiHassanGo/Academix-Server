require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;

const app = express();
const corsOptions = {
  origin: ["https://academix-a7d0b.web.app","https://academix-a7d0b.firebaseapp.com","http://localhost:5173"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ygrer.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const database = client.db("Academix");
    
    const enrollmentsCollection = client.db("Academix").collection("Enrolled-Classes");

    const userCollection = client.db("Academix").collection("users");
    const teachersCollection = client.db("Academix").collection("teachers");
    const classesCollection = client.db("Academix").collection("classes");

    const assignmentsCollection = client
      .db("Academix")
      .collection("assignments");
   
 
    const feedbackCollection = client
      .db("Academix")
      .collection("feedbacks");
   
 

      app.post("/jwt", async (req, res) => {
        const user = req.body;
        if (!user?.email) {
          return res.status(400).send({ message: "Email is required" });
        }
  
        try {
          const token = jwt.sign({ email: user.email }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "30min",
          });
          res.send({ token });
        } catch (error) {
          console.error("Error generating JWT token:", error);
          res.status(500).send({ message: "Failed to generate token", error });
        }
      });
  
   
      const verifyToken = (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
  
        const token = authHeader.split(" ")[1];
        if (!token) {
          return res.status(401).send({ message: "Unauthorized access" });
        }
  
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          if (err) {
            return res.status(403).send({ message: "Forbidden access" });
          }
          req.decoded = decoded;
          next();
        });
      };
  
      const verifyAdmin = async (req, res, next) => {
        const email = req.decoded.email;
        const user = await userCollection.findOne({ email });
        if (user?.role !== "admin") {
          return res.status(403).send({ message: "Forbidden access" });
        }
        next();
      };
  
      const verifyTeacher = async (req, res, next) => {
        const email = req.decoded.email;
        const user = await userCollection.findOne({ email });
        if (user?.role !== "teacher") {
          return res.status(403).send({ message: "Forbidden access" });
        }
        next();
      };
  
   
      app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
        try {
          const users = await userCollection.find().toArray();
          res.send(users);
        } catch (error) {
          console.error("Error fetching users:", error);
          res.status(500).send({ message: "Failed to fetch users", error });
        }
      });
      app.get("/user/student/:email", verifyToken, async (req, res) => {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ message: "Unauthorized access" });
        }
      
        const user = await userCollection.findOne({ email });
        const isStudent = user?.role === "student";
        res.send({ student: isStudent });
      });
    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Unauthorized access" });
      }

      const user = await userCollection.findOne({ email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.patch("/teachers/:email", async (req, res) => {
      const email = req.params.email;

      try {
       
        const updateDoc = {
          $set: { status: "approved" },
        };
        const result = await teachersCollection.updateOne({ email }, updateDoc);

 
        const user = await userCollection.findOne({ email });
        if (!user) {
          const teacher = await teachersCollection.findOne({ email });
          const newUser = {
            name: teacher.name,
            email: teacher.email,
            role: "teacher",
            photoURL: teacher.image,
          };
          await userCollection.insertOne(newUser);
        }

        res.send(result);
      } catch (error) {
        console.error("Error approving teacher:", error);
        res.status(500).send({ message: "Failed to approve teacher", error });
      }
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid user ID" });
        }

        try {
     
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: { role: "admin" },
          };

          const result = await userCollection.updateOne(filter, updateDoc);

          if (result.modifiedCount === 0) {
            return res
              .status(404)
              .send({ message: "User not found or already an admin" });
          }

          res.send({ message: "User role updated to admin successfully" });
        } catch (error) {
          console.error("Error updating user role:", error);
          res
            .status(500)
            .send({ message: "Failed to update user role", error });
        }
      }
    );
    app.patch(
      "/teachers/:id/reject",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid teacher ID" });
        }

        try {
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: { status: "rejected" },
          };

          const result = await teachersCollection.updateOne(filter, updateDoc);

          if (result.modifiedCount === 0) {
            return res
              .status(404)
              .send({ message: "Teacher not found or already rejected" });
          }

          res.send({ message: "Teacher rejected successfully" });
        } catch (error) {
          console.error("Error rejecting teacher:", error);
          res.status(500).send({ message: "Failed to reject teacher", error });
        }
      }
    );
    app.get("/users/email/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
    
      try {
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user by email:", error);
        res.status(500).send({ message: "Failed to fetch user data", error });
      }
    });
    app.patch(
      "/user/teacher/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid user ID" });
        }

        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: { role: "teacher" },
        };

        try {
          const result = await userCollection.updateOne(filter, updatedDoc);
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Error updating user role", error });
        }
      }
    );

    app.post("/login", async (req, res) => {
      const { email, password } = req.body;
    
      const user = await userCollection.findOne({ email });
    
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
    
      if (user.password !== password) {
        return res.status(401).send({ message: "Incorrect password" });
      }
    
      const token = jwt.sign(
        { _id: user._id, email: user.email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
    
      res.send({ token });
    });

    app.post("/users", async (req, res) => {
      const { name, email, photoURL, role, uid } = req.body; 
    
      if (!email || !uid) {
        return res.status(400).send({ message: "Email and UID are required" });
      }
    
      try {
        const existingUser = await userCollection.findOne({ email });
    
        if (existingUser) {
          return res.send({
            message: "User already exists",
            insertedId: existingUser._id,
          });
        }
    
        const newUser = { name, email, photoURL, role: role || "student", uid }; 
        const result = await userCollection.insertOne(newUser);
    
        res.status(201).send({ insertedId: result.insertedId });
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).send({ message: "Failed to save user", error });
      }
    });

    app.patch("/users", async (req, res) => {
      const email = req.body.email;
      const filter = { email };
      const updatedDoc = {
        $set: {
          lastSignInTime: req.body?.lastSignInTime,
        },
      };

      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/teachers", async (req, res) => {
      const { name, email, image, experience, title, category, status } =
        req.body;

      if (!name || !email || !experience || !title || !category) {
        return res.status(400).send({ message: "Missing required fields" });
      }

      const newTeacher = {
        name,
        email,
        image,
        experience,
        title,
        category,
        status,
      };

      try {
        const result = await teachersCollection.insertOne(newTeacher);
        res.status(200).send({ acknowledged: true });
      } catch (error) {
        console.error("Error inserting teacher:", error);
        res
          .status(500)
          .send({ message: "Failed to submit teacher data", error });
      }
    });
    app.get("/teachers/pending", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const pendingTeachers = await teachersCollection
          .find({ status: "pending" })
          .toArray();
        res.send(pendingTeachers);
      } catch (error) {
        console.error("Error fetching pending teachers:", error);
        res
          .status(500)
          .send({ message: "Failed to fetch pending teachers", error });
      }
    });

    app.get("/teacher/status/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
    
      try {
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
    
        const isTeacher = user.role === "teacher"; 
        res.send({ isTeacher });
      } catch (error) {
        console.error("Error fetching teacher status:", error);
        res.status(500).send({ message: "Failed to fetch teacher status", error });
      }
    });

    app.post("/classes", async (req, res) => {
      const classData = req.body;

      try {
        const result = await classesCollection.insertOne(classData);
        res.status(201).send(result);
      } catch (error) {
        console.error("Error adding class:", error);
        res.status(500).send({ message: "Failed to add class", error });
      }
    });
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const updatedClass = req.body;

      try {
        const result = await classesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedClass }
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating class:", error);
        res.status(500).send({ message: "Failed to update class", error });
      }
    });
app.get("/classes", async (req, res) => {
  const teacherEmail = req.query.email;

  try {
    let query = {};
    if (teacherEmail) {
      query.email = teacherEmail; 
    }

    const classes = await classesCollection.find(query).toArray();
    res.send(classes);
  } catch (error) {
    console.error("Error fetching classes:", error);
    res.status(500).send({ message: "Failed to fetch classes", error });
  }
});

app.patch(
  "/classes/:id/approve",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const id = req.params.id;
    try {
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "approved" } }
      );
      res.send(result);
    } catch (error) {
      console.error("Error approving class:", error);
      res.status(500).send({ message: "Failed to approve class", error });
    }
  }
);
app.patch(
  "/classes/:id/reject",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    const id = req.params.id;
    try {
      const result = await classesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected" } }
      );
      res.send(result);
    } catch (error) {
      console.error("Error rejecting class:", error);
      res.status(500).send({ message: "Failed to reject class", error });
    }
  }
);

    app.delete("/classes/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await classesCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    app.get("/classes/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const classData = await classesCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!classData) {
          return res.status(404).send({ message: "Class not found" });
        }
        res.send(classData);
      } catch (error) {
        console.error("Error fetching class details:", error);
        res.status(500).send({ message: "Failed to fetch class details", error });
      }
    });


    app.get("/enrollments/user/:email", verifyToken, async (req, res) => {
      const userEmail = req.params.email;
      
      if (!userEmail) {
        return res.status(400).send({ message: "User email is required" });
      }
    
      try {
        const enrollments = await enrollmentsCollection
          .find({ userEmail })
          .toArray();
    
     
        const enrolledClasses = await Promise.all(
          enrollments.map(async (enrollment) => {
            const classData = await classesCollection.findOne({
              _id: new ObjectId(enrollment.classId)
            });
            return {
              ...enrollment,
              classDetails: classData
            };
          })
        );
    
        res.status(200).json(enrolledClasses);
      } catch (error) {
        console.error("Error fetching enrolled classes:", error);
        res.status(500).json({ 
          message: "Failed to fetch enrolled classes", 
          error: error.message 
        });
      }
    });
    app.get("/users/count", async (req, res) => {
      try {
        const count = await userCollection.countDocuments();
        res.send({ total: count });
      } catch (error) {
        console.error("Error fetching user count:", error);
        res.status(500).send({ message: "Failed to fetch user count", error });
      }
    });
    app.get('/teachers/count', async (req, res) => {
      try {
        const count = await teachersCollection.countDocuments(); 
        res.json({ total: count });
      } catch (error) {
        res.status(500).json({ error: 'An error occurred while fetching the count of teachers.' });
      }
    });
    app.get("/enrollments/count", async (req, res) => {
      try {
        const count = await enrollmentsCollection.countDocuments();
        res.send({ total: count });
      } catch (error) {
        console.error("Error fetching enrollments count:", error);
        res.status(500).send({ message: "Failed to fetch enrollments count", error });
      }
    });

    app.post("/assignments/:assignmentId/submit", async (req, res) => {
      try {
        const assignmentId = req.params.assignmentId;
        const { userId, classId } = req.body;
    
     
        const classUpdateResult = await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $inc: { submissionCount: 1 } }
        );
    
        if (classUpdateResult.modifiedCount === 0) {
          throw new Error("Failed to update class submission count.");
        }
    
        res.status(200).send({ message: "Assignment submitted successfully!" });
      } catch (error) {
        console.error("Error submitting assignment:", error);
        res.status(500).send({ message: "Failed to submit assignment", error });
      }
    });

    app.post("/enroll/:classId", verifyToken, async (req, res) => {
      const { classId } = req.params;
      const { userId, userName, userEmail, className, classPrice } = req.body;
    
      if (!classId || !userEmail) {
        return res.status(400).send({ message: "Class ID and User Email are required" });
      }
    
      try {
      
        const existingEnrollment = await enrollmentsCollection.findOne({
          classId: new ObjectId(classId),
          userEmail
        });
    
        if (existingEnrollment) {
          return res.status(400).json({ message: "Already enrolled in this class" });
        }
    
        const enrollment = {
          classId: new ObjectId(classId),
          userId, 
          userEmail,
          userName,
          className,
          classPrice,
          enrolledAt: new Date(),
        };
    
        const result = await enrollmentsCollection.insertOne(enrollment);
    
        
        await classesCollection.updateOne(
          { _id: new ObjectId(classId) },
          { $inc: { enrollmentCount: 1 } }
        );
    
        res.status(200).json({ message: "Enrollment successful!", result });
      } catch (error) {
        console.error("Error enrolling in class:", error);
        res.status(500).json({ message: "Failed to enroll in class", error: error.message });
      }
    });
    
    
    app.get("/assignments/:classId", async (req, res) => {
      try {
        const classId = req.params.classId;
        console.log("Fetching assignments for classId:", classId);
    
     
        const assignments = await assignmentsCollection
          .find({ classId: classId }) 
          .toArray();
    
        console.log("Assignments fetched:", assignments);
        res.send(assignments);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        res.status(500).send({ message: "Failed to fetch assignments", error });
      }
    });
    
    app.get("/feedback", async (req, res) => {
      try {
        const feedback = await feedbackCollection.find().toArray();
        res.json(feedback);
      } catch (error) {
        console.error("Error fetching feedback:", error);
        res.status(500).json({ message: "Failed to fetch feedback", error });
      }
    });

    app.post("/feedback", async (req, res) => {
      try {
        const { userId, userName, userPhoto, classId, rating, review } = req.body;
    
      
        const user = await userCollection.findOne({ _id: new ObjectId(userId) });
        const finalUserName = userName || user?.name || "Anonymous";
        const finalUserPhoto = userPhoto || user?.photoURL || null;
    
        await feedbackCollection.insertOne({
          userId: new ObjectId(userId),
          userName: finalUserName,
          userPhoto: finalUserPhoto,
          classId: new ObjectId(classId),
          rating,
          review,
          createdAt: new Date(),
        });
    
        res.status(201).send({ message: "Feedback submitted successfully!" });
      } catch (error) {
        console.error("Error submitting feedback:", error);
        res.status(500).send({ message: "Failed to submit feedback", error });
      }
    });
    

    app.post("/assignments", async (req, res) => {
      const assignmentData = req.body;
      try {
        const result = await assignmentsCollection.insertOne(assignmentData);

        await classesCollection.updateOne(
          { _id: new ObjectId(assignmentData.classId) },
          { $inc: { assignmentCount: 1 } }
        );
        res.status(201).send(result);
      } catch (error) {
        console.error("Error adding assignment:", error);
        res.status(500).send({ message: "Failed to add assignment", error });
      }
    });



    app.get("/teachers", async (req, res) => {
      const email = req.query.email;
      const teacher = await teachersCollection.find({ email }).toArray();
      res.json(teacher);
    });
    app.patch("/teachers/:id/reject", async (req, res) => {
      const id = req.params.id;
    
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid teacher ID" });
      }
    
      try {
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { status: "rejected" },
        };
    
        const result = await teachersCollection.updateOne(filter, updateDoc);
    
        if (result.modifiedCount === 0) {
          return res.status(404).send({ message: "Teacher not found or already rejected." });
        }
    
        res.send({ message: "Teacher rejected successfully." });
      } catch (error) {
        console.error("Error rejecting teacher:", error);
        res.status(500).send({ message: "Failed to reject teacher.", error });
      }
    });
    
    app.patch("/teachers/:email", async (req, res) => {
      const email = req.params.email;
    
      try {
      
        const updateDoc = {
          $set: { status: "approved" },
        };
        const teacherResult = await teachersCollection.updateOne({ email }, updateDoc);
    
        if (teacherResult.modifiedCount === 0) {
          return res.status(404).send({ message: "Teacher not found or already approved." });
        }
    
     
        const user = await userCollection.findOne({ email });
    
        if (user) {
         
          const userUpdate = {
            $set: { role: "teacher" },
          };
          await userCollection.updateOne({ email }, userUpdate);
        } else {
         
          const teacher = await teachersCollection.findOne({ email });
          const newUser = {
            name: teacher.name,
            email: teacher.email,
            role: "teacher",
            photoURL: teacher.image || null,
          };
          await userCollection.insertOne(newUser);
        }
    
        res.send({ message: "Teacher approved and role updated successfully." });
      } catch (error) {
        console.error("Error approving teacher:", error);
        res.status(500).send({ message: "Failed to approve teacher", error });
      }
    });
    
app.patch("/users/role/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  const { role } = req.body;

  try {
    const result = await userCollection.updateOne(
      { email },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
     
      const teacher = await teachersCollection.findOne({ email });
      if (teacher) {
        await userCollection.insertOne({
          name: teacher.name,
          email: teacher.email,
          role: "teacher",
          photoURL: teacher.image,
        });
      }
    }

    res.send({ success: true });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).send({ message: "Failed to update user role", error });
  }
});
    

    app.get("/classes/:classId", async (req, res) => {
      try {
        const classId = req.params.classId;
        console.log("Fetching class details for classId:", classId);
    
        const classData = await classesCollection.findOne({ _id: new ObjectId(classId) });
    
        if (!classData) {
          console.log("Class not found for classId:", classId);
          return res.status(404).send({ message: "Class not found" });
        }
    
        console.log("Class data fetched:", classData);
        res.send(classData);
      } catch (error) {
        console.error("Error fetching class details:", error);
        res.status(500).send({ message: "Failed to fetch class details", error });
      }
    });

    app.get("/classes/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        console.log("Fetching class details for userId:", userId); 
    
        const classData = await classesCollection.findOne({ _id: new ObjectId(userId) });
    
        if (!classData) {
          console.log("Class not found for userId:", userId); 
          return res.status(404).send({ message: "Class not found" });
        }
    
        console.log("Class data fetched:", classData); 
        res.send(classData);
      } catch (error) {
        console.error("Error fetching class details:", error);
        res.status(500).send({ message: "Failed to fetch class details", error });
      }
    });
    app.get("/users/email/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
    
      try {
        const user = await userCollection.findOne({ email });
        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user by email:", error);
        res.status(500).send({ message: "Failed to fetch user data", error });
      }
    });
    app.get("/users/:userId", verifyToken, async (req, res) => {
      const userId = req.params.userId;
    
      try {
        const user = await userCollection.findOne({ uid: userId });
        if (!user) {
          return res.status(404).send({ message: "User not found!" });
        }
        res.send(user);
      } catch (error) {
        console.error("Error fetching user details:", error);
        res.status(500).send({ message: "Failed to fetch user details", error });
      }
    });
    
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email });
      if (!user) {
        return res.status(404).send({ message: "User not found!" });
      }
      res.send(user);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("beshi beshi poralekha");
});

app.listen(port, () => {
  console.log(`Academix is getting warmer in port: ${port}`);
});
