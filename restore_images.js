import fs from 'fs';

// Original working Unsplash URLs
const unsplashImages = {
  // Group 1
  s: {
    story: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Sun: "https://images.unsplash.com/photo-1534840639212-9c184e7d0596?auto=format&fit=crop&q=80&w=400",
      Snake: "https://images.unsplash.com/photo-1531386151447-fd76ad50012f?auto=format&fit=crop&q=80&w=400",
      Slide: "https://images.unsplash.com/photo-1574291819-ce2791845455?auto=format&fit=crop&q=80&w=400"
    }
  },
  a: {
    story: "https://images.unsplash.com/photo-1550592704-6c76defa9985?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Ant: "https://images.unsplash.com/photo-1559535332-db9971090454?auto=format&fit=crop&q=80&w=400",
      Apple: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&q=80&w=400",
      Arrow: "https://images.unsplash.com/photo-1511306162219-1c99026362f3?auto=format&fit=crop&q=80&w=400"
    }
  },
  t: {
    story: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Tent: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?auto=format&fit=crop&q=80&w=400",
      Tiger: "https://images.unsplash.com/photo-1508817628294-5a453fa0b8fb?auto=format&fit=crop&q=80&w=400",
      Tennis: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&q=80&w=400"
    }
  },
  i: {
    story: "https://images.unsplash.com/photo-1516962215378-7fa2e137ae93?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Ink: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=400",
      Insects: "https://images.unsplash.com/photo-1475809913362-28a064062ccd?auto=format&fit=crop&q=80&w=400",
      Igloo: "https://images.unsplash.com/photo-1574291819-ce2791845455?auto=format&fit=crop&q=80&w=400"
    }
  },
  p: {
    story: "https://images.unsplash.com/photo-1526336028061-b3d801ed29f3?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Panda: "https://images.unsplash.com/photo-1564349683136-77e08bef1ef1?auto=format&fit=crop&q=80&w=400",
      Pinwheel: "https://images.unsplash.com/photo-1536633100088-084992569503?auto=format&fit=crop&q=80&w=400",
      Pie: "https://images.unsplash.com/photo-1568571780765-9276ac8b75a2?auto=format&fit=crop&q=80&w=400"
    }
  },
  n: {
    story: "https://images.unsplash.com/photo-1510519133418-24103893335e?auto=format&fit=crop&q=80&w=600",
    vocab: {
      Net: "https://images.unsplash.com/photo-1590644365607-1c5a519a9a37?auto=format&fit=crop&q=80&w=400",
      Nest: "https://images.unsplash.com/photo-1510519133418-24103893335e?auto=format&fit=crop&q=80&w=400",
      Nut: "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&q=80&w=400"
    }
  }
};

const data = JSON.parse(fs.readFileSync('./src/data/curriculum.json', 'utf-8'));

data.groups.forEach(group => {
  group.letters.forEach(letter => {
    const letterKey = letter.id;
    
    if (unsplashImages[letterKey]) {
      if (letter.story && unsplashImages[letterKey].story) {
        letter.story.image = unsplashImages[letterKey].story;
      }
      
      if (letter.vocabulary && unsplashImages[letterKey].vocab) {
        letter.vocabulary.forEach(vocab => {
          if (unsplashImages[letterKey].vocab[vocab.word]) {
            vocab.image = unsplashImages[letterKey].vocab[vocab.word];
          }
        });
      }
    }
  });
});

fs.writeFileSync('./src/data/curriculum.json', JSON.stringify(data, null, 2));
console.log('Images restored successfully!');
