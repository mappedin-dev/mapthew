import { Router } from "express";
import queueRoutes from "./queue.js";
import configRoutes from "./config.js";
import searchRoutes from "./search.js";

const router: Router = Router();

// Mount sub-routers
router.use("/queue", queueRoutes);
router.use("/config", configRoutes);
router.use("/search", searchRoutes);

export default router;
