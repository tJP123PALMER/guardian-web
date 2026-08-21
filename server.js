import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = Number(process.env.PORT || 3010);
const API_KEY = process.env.GUARDIAN_API_KEY || "CHANGE_ME";
const clients = new Set();

let state = {
  connected: false,
  lastHeartbeat: null,
  units: [
    { callsign: "K06P1", status: "Home Station", station: "Hawick", crew: 4 },
    { callsign: "K06P2", status: "Available Home Address", station: "Hawick", crew: 4 },
    { callsign: "K07A1", status: "In Attendance at Incident", station: "Kelso", crew: 3 },
    { callsign: "J02G1", status: "Mobile to Incident", station: "Jedburgh", crew: 2 }
  ],
  incidents: [
    { id: 2401, type: "Structure Fire", postal: "AB12", address: "High Street", description: "Smoke reported from a two-storey building.", status: "Active", units: ["K07A1"] },
    { id: 2402, type: "RTC", postal: "AB13", address: "Main Road / Junction", description: "Two vehicle road traffic collision.", status: "Active", units: ["J02G1"] }
  ],
  calls999: [],
  messages: [],
  updatedAt: new Date().toISOString()
};

const commands = new Map();

function auth(req, res, next) {
  const supplied = req.header("x-guardian-key");
  if (!supplied || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(API_KEY))) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

function publish(type, payload) {
  const message = `data: ${JSON.stringify({ type, payload })}\n\n`;
  for (const res of clients) res.write(message);
}

app.get("/api/state", (req, res) => res.json({ ok: true, state }));

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: ${JSON.stringify({ type: "state", payload: state })}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

app.post("/api/fivem/state", auth, (req, res) => {
  const incoming = req.body || {};
  state = {
    ...state,
    ...incoming,
    connected: true,
    lastHeartbeat: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  publish("state", state);
  res.json({ ok: true });
});

app.get("/api/fivem/commands", auth, (req, res) => {
  const pending = [...commands.values()].filter(c => !c.acknowledged);
  res.json({ ok: true, commands: pending });
});

app.post("/api/fivem/commands/:id/ack", auth, (req, res) => {
  const cmd = commands.get(req.params.id);
  if (cmd) {
    cmd.acknowledged = true;
    cmd.acknowledgedAt = new Date().toISOString();
  }
  res.json({ ok: true });
});

app.post("/api/command", (req, res) => {
  const { action, data = {} } = req.body || {};
  const allowed = new Set([
    "createIncident", "assignAppliance", "closeIncident",
    "updateIncident", "sendMessage", "dismiss999Call",
    "setApplianceCrew", "setCrewMember", "setIncidentRole"
  ]);
  if (!allowed.has(action)) return res.status(400).json({ ok: false, error: "Unsupported action" });

  const id = crypto.randomUUID();
  const command = { id, action, data, createdAt: new Date().toISOString(), acknowledged: false };
  commands.set(id, command);
  publish("commandQueued", command);
  res.json({ ok: true, command });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Guardian Web running on http://localhost:${PORT}`);
});