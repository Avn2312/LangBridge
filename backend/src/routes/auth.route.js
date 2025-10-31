import express from "express";
import { onboard ,logout, login, signup } from "../controllers/auth.controller.js";
import { protectRoute } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.post("/onboarding", protectRoute,  onboard);

// forget-password, reset-password, or welcome email on your own if u want to add

// check if user is logged in 
router.get("/me", protectRoute, (req, res) => {
    res.status(200).json({ success: true, user: req.user });
})

export default router;
