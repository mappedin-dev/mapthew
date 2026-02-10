import { Router } from "express";
import queueRoutes from "./queue.js";
import configRoutes from "./config.js";
import searchRoutes from "./search.js";
import secretsRoutes from "./secrets.js";

const router: Router = Router();

// Mount sub-routers
router.use("/queue", queueRoutes);
router.use("/config", configRoutes);
router.use("/search", searchRoutes);
router.use("/secrets", secretsRoutes);

export default router;
