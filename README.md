# Happy Diwali — Virtual Pataka Mela 🪔

Burst real Indian Diwali crackers in 3D without spending a rupee or putting any smoke in the air.

**Crackers:** Bullet Bomb · Chocolate Bomb · Alu Bomb · Sutli Bomb · Ladi (100 wala) · Anar · Phuljhari · Chakri · Rocket · Balloon Sky Shot. Each one shows its market price, struck through: everything here is FREE.

## Run

```bash
npm start            # serves on http://127.0.0.1:5173
# or
python -m http.server 5173
```

It's a static site with no build step. ES modules need a local server, so don't open `index.html` straight from disk. Three.js loads from the jsDelivr CDN.

## How to play
1. Pick a pataka from the **Pataka Dukaan**.
2. **Your cursor is a burning lighter.** Hold its flame on the cracker's bati (fuse) for a moment and it catches: **1… 2… 3… BOOM!** On touch screens, or if you prefer, tap the cracker or press **Light it!** / **Space** and the lighter does it for you.
3. Choose where to burst: **Aangan** (courtyard) or **Chhat** (rooftop, with the whole town around you). **360°** circles the house so you can see it from every side.
4. For the phuljhari, move your mouse or finger to wave it around.
5. Drag to look around. The top-left buttons toggle sound, the neighbours' fireworks, and camera reset.

## What's inside
| File | Role |
|---|---|
| `js/environment.js` | Courtyard at night: house with an open door, kandils, jhalar lights (chase/twinkle/rain patterns), marigold toran, shubh-labh, Lakshmi footprints, diyas, 5 rangolis, skyline with a temple, starry Amavasya sky |
| `js/town.js`, `js/towntex.js` | Procedural Indian town: painted concrete houses with chajjas, grills, balconies, AC units, shops and signboards; water tanks, mumtys, rebar, dish antennas; light strands, poles, wires, sodium lamps, trees, temple, mobile tower. Drawn in ~20 draw calls with a cheap night shader |
| `js/crackers.js` | Catalogue, prices and procedural 3D models with canvas-painted wrappers |
| `js/effects.js` | Burst behaviour for each kind: bang, fountain, sparkler, spinner, rocket, multi-shot sky shell, ladi chain |
| `js/audio.js` | Synthesized sound design (Web Audio): crack, thump, rumble and a street-echo reverb |
| `js/particles.js` | Spark/smoke particle pools and paper debris |

## Using real recordings
All sounds are synthesized. To use real recordings you have rights to, drop the files in `sounds/` and map them in `sounds/manifest.json`:
```json
{ "sutli": "sutli.mp3", "chocolate": "choco.mp3", "alu": "alu.mp3", "bullet": "bullet.mp3" }
```

## Performance
- The game scales its render resolution automatically (and drops MSAA, then shadows) if the frame rate falls below about 40 fps.
- On laptops with integrated graphics, close other tabs running the game. They share the same GPU.
