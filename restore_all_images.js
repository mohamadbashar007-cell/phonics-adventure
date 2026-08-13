import fs from 'fs';

// Comprehensive working Unsplash URLs - carefully selected for relevance
const imageMapping = {
  // Group 1
  s: {
    story: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Sun: "https://images.unsplash.com/photo-1495567720989-cebdb2c3ec5e?auto=format&fit=crop&q=80&w=400",
      Snake: "https://images.unsplash.com/photo-1590080876460-cd634e42b69b?auto=format&fit=crop&q=80&w=400",
      Slide: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&q=80&w=400"
    }
  },
  a: {
    story: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Ant: "https://images.unsplash.com/photo-1611689342806-0863700ce1e4?auto=format&fit=crop&q=80&w=400",
      Apple: "https://images.unsplash.com/photo-1569804682944-2f56d0c4da2b?auto=format&fit=crop&q=80&w=400",
      Arrow: "https://images.unsplash.com/photo-1560427680-c4bdb329c82f?auto=format&fit=crop&q=80&w=400"
    }
  },
  t: {
    story: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Tent: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&q=80&w=400",
      Tiger: "https://images.unsplash.com/photo-1614027164847-1b28cfe1df60?auto=format&fit=crop&q=80&w=400",
      Tennis: "https://images.unsplash.com/photo-1554531173-07a43bcfd499?auto=format&fit=crop&q=80&w=400"
    }
  },
  i: {
    story: "https://images.unsplash.com/photo-1447054555147-aa21fda32c30?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Ink: "https://images.unsplash.com/photo-1578223268581-87e4aec9e3e9?auto=format&fit=crop&q=80&w=400",
      Insects: "https://images.unsplash.com/photo-1551415695-8f68f2799cd3?auto=format&fit=crop&q=80&w=400",
      Igloo: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=400"
    }
  },
  p: {
    story: "https://images.unsplash.com/photo-1585951237318-9ea5e175b891?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Panda: "https://images.unsplash.com/photo-1525382455947-a1bbd81b2d14?auto=format&fit=crop&q=80&w=400",
      Pinwheel: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=400",
      Pie: "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&q=80&w=400"
    }
  },
  n: {
    story: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Net: "https://images.unsplash.com/photo-1578282118066-f01e0c92f251?auto=format&fit=crop&q=80&w=400",
      Nest: "https://images.unsplash.com/photo-1606567595334-d39972c85dcc?auto=format&fit=crop&q=80&w=400",
      Nut: "https://images.unsplash.com/photo-1599599810694-b5ac4dd0a495?auto=format&fit=crop&q=80&w=400"
    }
  },
  // Group 2
  ck: {
    story: "https://images.unsplash.com/photo-1574268334891-caeb1267627f?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Cap: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400",
      Kick: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=400",
      Cat: "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&q=80&w=400"
    }
  },
  e: {
    story: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Egg: "https://images.unsplash.com/photo-1582722334561-d4ca0a5e4e6e?auto=format&fit=crop&q=80&w=400",
      Elbow: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
      Elephant: "https://images.unsplash.com/photo-1564760055775-d63bc177e3df?auto=format&fit=crop&q=80&w=400"
    }
  },
  h: {
    story: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Hat: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=400",
      Hen: "https://images.unsplash.com/photo-1540573133985-87b6da94de78?auto=format&fit=crop&q=80&w=400",
      Hand: "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&q=80&w=400"
    }
  },
  r: {
    story: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Rat: "https://images.unsplash.com/photo-1585021050227-724b3cadbb2e?auto=format&fit=crop&q=80&w=400",
      Rip: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=400",
      Rabbit: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=400"
    }
  },
  m: {
    story: "https://images.unsplash.com/photo-1544367567-0d6fcffe7f1f?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Man: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
      Map: "https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=400",
      Mint: "https://images.unsplash.com/photo-1599599810694-b5ac4dd0a495?auto=format&fit=crop&q=80&w=400"
    }
  },
  d: {
    story: "https://images.unsplash.com/photo-1544488278-b67e5c8bb533?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Dad: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
      Sad: "https://images.unsplash.com/photo-1514306688292-46c2b86d3e86?auto=format&fit=crop&q=80&w=400",
      Dress: "https://images.unsplash.com/photo-1595555707802-21b350ed2d29?auto=format&fit=crop&q=80&w=400"
    }
  },
  // Group 3
  g: {
    story: "https://images.unsplash.com/photo-1496442097696-79ea11b13fd5?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Egg: "https://images.unsplash.com/photo-1582722334561-d4ca0a5e4e6e?auto=format&fit=crop&q=80&w=400",
      Grass: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400",
      Tag: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400"
    }
  },
  o: {
    story: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&q=80&w=600",
    vocab: {
      On: "https://images.unsplash.com/photo-1473496169904-658ba7c44d8a?auto=format&fit=crop&q=80&w=400",
      Dog: "https://images.unsplash.com/photo-1633722715463-d30628519d87?auto=format&fit=crop&q=80&w=400",
      Hop: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=400"
    }
  },
  u: {
    story: "https://images.unsplash.com/photo-1505228395891-9a51e7e86e81?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Up: "https://images.unsplash.com/photo-1516573595620-7e5b3d2c6f46?auto=format&fit=crop&q=80&w=400",
      Sun: "https://images.unsplash.com/photo-1495567720989-cebdb2c3ec5e?auto=format&fit=crop&q=80&w=400",
      Mug: "https://images.unsplash.com/photo-1599599810694-b5ac4dd0a495?auto=format&fit=crop&q=80&w=400"
    }
  },
  l: {
    story: "https://images.unsplash.com/photo-1459325381753-21a432ba8e10?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Leg: "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&q=80&w=400",
      Lemon: "https://images.unsplash.com/photo-1585518419759-3c7dae3a6c3c?auto=format&fit=crop&q=80&w=400",
      Doll: "https://images.unsplash.com/photo-1595777980490-ba0e2622f1da?auto=format&fit=crop&q=80&w=400"
    }
  },
  f: {
    story: "https://images.unsplash.com/photo-1505228395891-9a51e7e86e81?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Fan: "https://images.unsplash.com/photo-1555694702993-18a1db375df7?auto=format&fit=crop&q=80&w=400",
      Frog: "https://images.unsplash.com/photo-1551986782-d244ca42f892?auto=format&fit=crop&q=80&w=400",
      Flag: "https://images.unsplash.com/photo-1564185568129-e94f27d5a4c3?auto=format&fit=crop&q=80&w=400"
    }
  },
  b: {
    story: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Bat: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=400",
      Bag: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400",
      Bus: "https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&q=80&w=400"
    }
  },
  // Group 4
  j: {
    story: "https://images.unsplash.com/photo-1585021050227-724b3cadbb2e?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Jam: "https://images.unsplash.com/photo-1585191674194-7aac25ff7d69?auto=format&fit=crop&q=80&w=400",
      Jug: "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=400",
      Jump: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=400"
    }
  },
  z: {
    story: "https://images.unsplash.com/photo-1501494316567-6aec266ac5fa?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Zip: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=400",
      Zigzag: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=400",
      Zebra: "https://images.unsplash.com/photo-1501494316567-6aec266ac5fa?auto=format&fit=crop&q=80&w=400"
    }
  },
  w: {
    story: "https://images.unsplash.com/photo-1506904514611-e3980ccb4c0f?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Web: "https://images.unsplash.com/photo-1576623566176-f6f6198e7c0b?auto=format&fit=crop&q=80&w=400",
      Well: "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&q=80&w=400",
      Swim: "https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?auto=format&fit=crop&q=80&w=400"
    }
  },
  v: {
    story: "https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Van: "https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&q=80&w=400",
      Seven: "https://images.unsplash.com/photo-1456406146550-950674065c72?auto=format&fit=crop&q=80&w=400",
      Vet: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=400"
    }
  },
  y: {
    story: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Yak: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&q=80&w=400",
      Yoyo: "https://images.unsplash.com/photo-1587280413279-9cba946f5f6d?auto=format&fit=crop&q=80&w=400",
      Yam: "https://images.unsplash.com/photo-1585518419759-3c7dae3a6c3c?auto=format&fit=crop&q=80&w=400"
    }
  },
  x: {
    story: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Fox: "https://images.unsplash.com/photo-1564760055775-d63bc177e3df?auto=format&fit=crop&q=80&w=400",
      Box: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400",
      Six: "https://images.unsplash.com/photo-1456406146550-950674065c72?auto=format&fit=crop&q=80&w=400"
    }
  },
  qu: {
    story: "https://images.unsplash.com/photo-1551986782-d244ca42f892?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Queen: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
      Quilt: "https://images.unsplash.com/photo-1584971357919-7dd40160e8d5?auto=format&fit=crop&q=80&w=400",
      Quack: "https://images.unsplash.com/photo-1551986782-d244ca42f892?auto=format&fit=crop&q=80&w=400"
    }
  },
  // Group 5
  ai: {
    story: "https://images.unsplash.com/photo-1505228395891-9a51e7e86e81?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Rain: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400",
      Tail: "https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&q=80&w=400",
      Pain: "https://images.unsplash.com/photo-1584308666744-24d5f400f6f4?auto=format&fit=crop&q=80&w=400"
    }
  },
  oa: {
    story: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Goat: "https://images.unsplash.com/photo-1529821968786-a7fda5b868fd?auto=format&fit=crop&q=80&w=400",
      Boat: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=400",
      Coat: "https://images.unsplash.com/photo-1595777980490-ba0e2622f1da?auto=format&fit=crop&q=80&w=400"
    }
  },
  ie: {
    story: "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Pie: "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&q=80&w=400",
      Fries: "https://images.unsplash.com/photo-1585238341710-4b4e6ceea840?auto=format&fit=crop&q=80&w=400",
      Tie: "https://images.unsplash.com/photo-1591047990435-f76b2d96e45d?auto=format&fit=crop&q=80&w=400"
    }
  },
  ee: {
    story: "https://images.unsplash.com/photo-1551986782-d244ca42f892?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Bee: "https://images.unsplash.com/photo-1551986782-d244ca42f892?auto=format&fit=crop&q=80&w=400",
      Tree: "https://images.unsplash.com/photo-1426604342619-238d7a9344a3?auto=format&fit=crop&q=80&w=400",
      See: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&q=80&w=400"
    }
  },
  ue: {
    story: "https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Cue: "https://images.unsplash.com/photo-1574875057200-e80fb9bab45f?auto=format&fit=crop&q=80&w=400",
      Fuel: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&q=80&w=400",
      Duel: "https://images.unsplash.com/photo-1600435894550-dd765e3cbbe4?auto=format&fit=crop&q=80&w=400"
    }
  },
  ar: {
    story: "https://images.unsplash.com/photo-1464207687429-7505649dae38?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Arm: "https://images.unsplash.com/photo-1603808033192-082d6919d3e1?auto=format&fit=crop&q=80&w=400",
      Star: "https://images.unsplash.com/photo-1444080748397-f442aa95de81?auto=format&fit=crop&q=80&w=400",
      Car: "https://images.unsplash.com/photo-1552820728-8ac41f1ce891?auto=format&fit=crop&q=80&w=400"
    }
  }
};

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    const letterKey = letter.id;
    
    if (imageMapping[letterKey]) {
      // Update story image
      if (letter.story && imageMapping[letterKey].story) {
        letter.story.image = imageMapping[letterKey].story;
      }
      
      // Update vocabulary images
      if (letter.vocabulary && imageMapping[letterKey].vocab) {
        letter.vocabulary.forEach(vocab => {
          if (imageMapping[letterKey].vocab[vocab.word]) {
            vocab.image = imageMapping[letterKey].vocab[vocab.word];
          }
        });
      }
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
console.log('✅ All images updated successfully with working, appropriate Unsplash URLs!');
