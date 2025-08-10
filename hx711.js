module.exports = function (RED) {
  function GetWeight(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // ---- Config values (with defaults) ----
    const dataPin = Number(config.hx_data);
    const sckPin = Number(config.hx_sck);
    const scale = Number(config.hx_scale) || 1;
    const gain = Number(config.hx_gain) || 128;
    const offset = Number(config.hx_offset) || 0;
    const avrg = Number(config.hx_avrg) || 1;

    // ---- Fallback require for HX711 native module ----
    let HX711;
    try {
      HX711 = require("@ataberkylmz/hx711");
    } catch (e1) {
      try {
        HX711 = require("@shroudedcode/hx711");
      } catch (e2) {
        node.status({ fill: "red", shape: "ring", text: "hx711 module not found" });
        node.error(
          "HX711 native module not found. Install build tools (build-essential, python3, make, g++) and reinstall this node.",
          e2
        );
        return; // cannot initialize
      }
    }

    // ---- Initialize sensor ----
    let sensor;
    try {
      sensor = new HX711(sckPin, dataPin, gain);
      if (typeof sensor.setScale === "function") sensor.setScale(scale);
      node.status({ fill: "blue", shape: "dot", text: "ready" });
    } catch (err) {
      node.status({ fill: "red", shape: "ring", text: "init failed" });
      node.error("Failed to initialize HX711 sensor. Check pins/gain.", err);
      return;
    }

    // ---- On input ----
    this.on("input", function (msg, send, done) {
      try {
        const avg = Number(msg?.avrg ?? avrg) || 1;
        const off = Number(msg?.offset ?? offset) || 0;

        if (msg && msg.tare) {
          if (typeof sensor.tare === "function") {
            sensor.tare(avg);
            node.status({ fill: "green", shape: "dot", text: `tare(${avg})` });
            msg.payload = { tare: true, avrg: avg };
          } else {
            throw new Error("tare() not supported by HX711 binding");
          }
        } else {
          if (typeof sensor.getUnits !== "function") {
            throw new Error("getUnits() not supported by HX711 binding");
          }
          const value = sensor.getUnits(avg) - off;
          msg.payload = value;
          msg.hx711 = { avrg: avg, offset: off, scale, gain, dataPin, sckPin };
          node.status({ fill: "blue", shape: "dot", text: `ok(${avg})` });
        }

        if (send) send(msg);
        else node.send(msg);
        if (done) done();
      } catch (err) {
        node.status({ fill: "red", shape: "dot", text: "read error" });
        node.error("HX711 read error", err);
        if (done) done(err);
      }
    });

    // ---- On node close ----
    this.on("close", function (done) {
      try {
        if (sensor && typeof sensor.powerDown === "function") {
          sensor.powerDown();
        }
      } catch (_e) {}
      done();
    });
  }

  RED.nodes.registerType("hx711", GetWeight);
};
