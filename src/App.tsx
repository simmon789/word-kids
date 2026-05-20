import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

type LanguageType = "en" | "th";
type TabType = "learn" | "score" | "shop" | "profile";
type ResultType = "idle" | "success" | "error";

type WordItem = {
  word: string;
  meaning: string;
};

type LetterTile = {
  id: string;
  value: string;
};

type UserProfile = {
  uid: string;
  email: string;
  name: string;
  className: string;
  avatar: string;
  theme: string;
  coins: number;
  totalCorrect: number;
};

type LeaderboardItem = {
  uid: string;
  name: string;
  className: string;
  avatar: string;
  coins: number;
  totalCorrect: number;
};

type RewardItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
};

type MyReward = {
  rewardId: string;
  name: string;
  price: number;
  icon: string;
};

type PracticeHistory = {
  word: string;
  language: LanguageType;
  earnedCoin: number;
};

const ENGLISH_WORDS: WordItem[] = [
  { word: "hello", meaning: "สวัสดี" },
  { word: "name", meaning: "ชื่อ" },
  { word: "my", meaning: "ของฉัน" },
  { word: "your", meaning: "ของคุณ" },
  { word: "pencil", meaning: "ดินสอ" },
  { word: "pen", meaning: "ปากกา" },
  { word: "bag", meaning: "กระเป๋า" },
  { word: "book", meaning: "หนังสือ" },
  { word: "desk", meaning: "โต๊ะเรียน" },
  { word: "chair", meaning: "เก้าอี้" },
  { word: "ruler", meaning: "ไม้บรรทัด" },
  { word: "eraser", meaning: "ยางลบ" },
  { word: "map", meaning: "แผนที่" },
  { word: "marker", meaning: "ปากกาเมจิก" },
  { word: "globe", meaning: "ลูกโลก" },
];

const THAI_WORDS: WordItem[] = [
  { word: "กา", meaning: "กา" },
  { word: "กิน", meaning: "กิน" },
  { word: "ไก่", meaning: "ไก่" },
  { word: "เก้า", meaning: "เก้า" },
  { word: "เก็บ", meaning: "เก็บ" },
  { word: "เก่ง", meaning: "เก่ง" },
  { word: "ขา", meaning: "ขา" },
  { word: "ของ", meaning: "ของ" },
  { word: "เข่า", meaning: "เข่า" },
  { word: "ข้าง", meaning: "ข้าง" },
  { word: "เขี่ย", meaning: "เขี่ย" },
  { word: "ขวา", meaning: "ขวา" },
  { word: "คำ", meaning: "คำ" },
  { word: "คน", meaning: "คน" },
  { word: "คืน", meaning: "คืน" },
  { word: "ครู", meaning: "ครู" },
  { word: "คุย", meaning: "คุย" },
  { word: "คิด", meaning: "คิด" },
  { word: "งา", meaning: "งา" },
  { word: "งวง", meaning: "งวง" },
];

const ENGLISH_DISTRACTORS = [
  "a",
  "e",
  "i",
  "o",
  "u",
  "s",
  "t",
  "r",
  "m",
  "n",
  "p",
  "d",
  "c",
  "b",
  "g",
  "k",
  "l",
  "y",
];

const THAI_DISTRACTORS = [
  "ก",
  "ข",
  "ค",
  "ง",
  "จ",
  "า",
  "ิ",
  "ี",
  "ุ",
  "ู",
  "เ",
  "ไ",
  "่",
  "้",
  "น",
  "ม",
  "ร",
  "ล",
  "ว",
  "ย",
];

const SHOP_ITEMS: RewardItem[] = [
  {
    id: "download-1-game",
    name: "โหลด 1 เกมส์",
    price: 100,
    icon: "🎮",
  },
  {
    id: "suki-bonus",
    name: "กินสุกี้ BONUS",
    price: 200,
    icon: "🍲",
  },
  {
    id: "toy-1-piece",
    name: "ได้ของเล่น 1 ชิ้น",
    price: 300,
    icon: "🧸",
  },
];

const AVATARS = ["🧒", "👦", "👧", "🐰", "🦊", "🐼", "⭐", "🚀"];
const THEMES = ["blue", "pink", "green", "purple", "yellow"];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>("learn");
  const [language, setLanguage] = useState<LanguageType>("en");
  const [wordIndex, setWordIndex] = useState(0);

  const [hasStarted, setHasStarted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerSlots, setAnswerSlots] = useState<Array<LetterTile | null>>([]);
  const [letterTray, setLetterTray] = useState<LetterTile[]>([]);
  const [message, setMessage] = useState(
    "กดเริ่มเรียน แล้วฟังเสียง จากนั้นเรียงตัวอักษรและเขียนคำศัพท์"
  );
  const [resultType, setResultType] = useState<ResultType>("idle");

  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [myRewards, setMyRewards] = useState<MyReward[]>([]);
  const [history, setHistory] = useState<PracticeHistory[]>([]);

  const [profileName, setProfileName] = useState("");
  const [profileClass, setProfileClass] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("🧒");
  const [profileTheme, setProfileTheme] = useState("blue");

  const [writingTick, setWritingTick] = useState(0);

  const writingPadRef = useRef<SignatureCanvas | null>(null);
  const writingBoxRef = useRef<HTMLDivElement | null>(null);

  const currentList = language === "en" ? ENGLISH_WORDS : THAI_WORDS;
  const currentWord = currentList[wordIndex];

  const wordUnits = useMemo(() => {
    return splitWord(currentWord.word, language);
  }, [currentWord.word, language]);

  const arrangedWord = answerSlots.map((slot) => slot?.value || "").join("");
  const isArrangeComplete = answerSlots.every(Boolean);
  const isArrangeCorrect = arrangedWord === currentWord.word;

  const hasWritten = useMemo(() => {
    return writingPadRef.current ? !writingPadRef.current.isEmpty() : false;
  }, [writingTick, activeTab, wordIndex]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      if (currentUser) {
        await ensureUserProfile(currentUser);
      } else {
        setProfile(null);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data() as UserProfile;
      setProfile(data);

      setProfileName(data.name || "");
      setProfileClass(data.className || "");
      setProfileAvatar(data.avatar || "🧒");
      setProfileTheme(data.theme || "blue");
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "publicProfiles"), orderBy("coins", "desc"), limit(10));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as LeaderboardItem);
      setLeaderboard(items);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const rewardsRef = collection(db, "users", user.uid, "rewards");

    const unsubscribe = onSnapshot(rewardsRef, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as MyReward);
      setMyRewards(items);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const historyRef = query(
      collection(db, "users", user.uid, "history"),
      orderBy("createdAt", "desc"),
      limit(8)
    );

    const unsubscribe = onSnapshot(historyRef, (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as PracticeHistory);
      setHistory(items);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    prepareNewQuestion();
  }, [language, wordIndex]);

  useEffect(() => {
    if (activeTab !== "learn") return;

    const resizeTimer = window.setTimeout(() => {
      resizeWritingCanvas();
    }, 150);

    const wrapper = writingBoxRef.current;
    let observer: ResizeObserver | null = null;

    if (wrapper && "ResizeObserver" in window) {
      observer = new ResizeObserver(() => {
        resizeWritingCanvas();
      });

      observer.observe(wrapper);
    }

    window.addEventListener("resize", resizeWritingCanvas);

    return () => {
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", resizeWritingCanvas);

      if (observer) {
        observer.disconnect();
      }
    };
  }, [activeTab, language, wordIndex]);

  useEffect(() => {
    if (!hasStarted || activeTab !== "learn") return;

    const timer = window.setTimeout(() => {
      speakWord();
    }, 450);

    return () => window.clearTimeout(timer);
  }, [wordIndex, language, hasStarted, activeTab]);

  async function ensureUserProfile(currentUser: User) {
    const userRef = doc(db, "users", currentUser.uid);
    const publicRef = doc(db, "publicProfiles", currentUser.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
      const defaultName = currentUser.email?.split("@")[0] || "นักเรียน";

      const data: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email || "",
        name: defaultName,
        className: "ป.1/1",
        avatar: "🧒",
        theme: "blue",
        coins: 0,
        totalCorrect: 0,
      };

      await setDoc(userRef, {
        ...data,
        createdAt: serverTimestamp(),
      });

      await setDoc(publicRef, {
        uid: currentUser.uid,
        name: data.name,
        className: data.className,
        avatar: data.avatar,
        coins: data.coins,
        totalCorrect: data.totalCorrect,
        updatedAt: serverTimestamp(),
      });
    }
  }

  function splitWord(word: string, lang: LanguageType) {
    if (lang === "en") {
      return word.toLowerCase().split("");
    }

    try {
      const SegmenterClass = (Intl as any).Segmenter;
      if (SegmenterClass) {
        const segmenter = new SegmenterClass("th", { granularity: "grapheme" });
        return Array.from(segmenter.segment(word), (x: any) => x.segment);
      }
    } catch {
      return Array.from(word);
    }

    return Array.from(word);
  }

  function prepareNewQuestion() {
    const units = splitWord(currentWord.word, language);
    const tray = createTray(units, language);

    setAnswerSlots(Array(units.length).fill(null));
    setLetterTray(tray);
    setShowAnswer(false);
    setResultType("idle");
    setWritingTick((prev) => prev + 1);
    setMessage("ฟังเสียง แล้วเรียงตัวอักษรให้ถูก จากนั้นเขียนคำศัพท์ลงบนกระดาน");

    window.setTimeout(() => {
      writingPadRef.current?.clear();
      resizeWritingCanvas();
    }, 80);
  }

  function createTray(units: string[], lang: LanguageType) {
    const distractors = lang === "en" ? ENGLISH_DISTRACTORS : THAI_DISTRACTORS;
    const numberOfExtra = Math.min(4, Math.max(2, units.length));
    const extraLetters: string[] = [];

    while (extraLetters.length < numberOfExtra) {
      const random = distractors[Math.floor(Math.random() * distractors.length)];
      extraLetters.push(random);
    }

    const allLetters = [...units, ...extraLetters].map((value, index) => ({
      id: `${value}-${index}-${Math.random().toString(36).slice(2)}`,
      value,
    }));

    return shuffleArray(allLetters);
  }

  function shuffleArray<T>(array: T[]) {
    return [...array].sort(() => Math.random() - 0.5);
  }

  function resizeWritingCanvas() {
    const signature = writingPadRef.current;
    const wrapper = writingBoxRef.current;

    if (!signature || !wrapper) return;

    const canvas = signature.getCanvas();
    const rect = wrapper.getBoundingClientRect();

    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");

    if (context) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(ratio, ratio);
    }

    signature.clear();
    setWritingTick((prev) => prev + 1);
  }

  function startLesson() {
    setHasStarted(true);
    setMessage("เริ่มเรียนแล้ว ฟังเสียงและทำแบบฝึกได้เลย");

    window.setTimeout(() => {
      speakWord();
    }, 250);
  }

  function speakWord() {
    const utterance = new SpeechSynthesisUtterance(currentWord.word);
    utterance.lang = language === "en" ? "en-US" : "th-TH";
    utterance.rate = 0.75;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);

    setMessage("ฟังเสียงแล้วเรียงตัวอักษร จากนั้นเขียนคำศัพท์");
  }

  function switchLanguage(lang: LanguageType) {
    setLanguage(lang);
    setWordIndex(0);
    setMessage(lang === "en" ? "เปลี่ยนเป็นแบบฝึกภาษาอังกฤษแล้ว" : "เปลี่ยนเป็นแบบฝึกภาษาไทยแล้ว");
  }

  function nextWord() {
    setWordIndex((prev) => (prev + 1) % currentList.length);
  }

  function prevWord() {
    setWordIndex((prev) => (prev - 1 + currentList.length) % currentList.length);
  }

  function clearLetters() {
    const selected = answerSlots.filter(Boolean) as LetterTile[];
    setLetterTray((prev) => shuffleArray([...prev, ...selected]));
    setAnswerSlots(Array(wordUnits.length).fill(null));
    setResultType("idle");
    setMessage("ล้างตัวอักษรแล้ว ลองเรียงใหม่ได้เลย");
  }

  function clearWriting() {
    writingPadRef.current?.clear();
    setWritingTick((prev) => prev + 1);
    setResultType("idle");
    setMessage("ล้างกระดานเขียนแล้ว เขียนใหม่ได้เลย");
  }

  function selectTile(tile: LetterTile) {
    const emptyIndex = answerSlots.findIndex((slot) => slot === null);
    if (emptyIndex === -1) {
      setMessage("ช่องคำตอบเต็มแล้ว ถ้าจะเปลี่ยนให้แตะตัวอักษรในช่องคำตอบก่อน");
      return;
    }

    const newSlots = [...answerSlots];
    newSlots[emptyIndex] = tile;

    setAnswerSlots(newSlots);
    setLetterTray((prev) => prev.filter((item) => item.id !== tile.id));
    setResultType("idle");
  }

  function removeSlot(index: number) {
    const tile = answerSlots[index];
    if (!tile) return;

    const newSlots = [...answerSlots];
    newSlots[index] = null;

    setAnswerSlots(newSlots);
    setLetterTray((prev) => shuffleArray([...prev, tile]));
    setResultType("idle");
  }

  async function checkAnswer() {
    if (!user) return;

    const written = writingPadRef.current ? !writingPadRef.current.isEmpty() : false;
    const currentArrangedWord = answerSlots.map((slot) => slot?.value || "").join("");
    const complete = answerSlots.every(Boolean);
    const correct = currentArrangedWord === currentWord.word;

    if (!complete) {
      setResultType("error");
      setMessage("ยังเรียงตัวอักษรไม่ครบทุกช่อง ลองเลือกตัวอักษรให้ครบก่อนนะ");
      return;
    }

    if (!correct) {
      setResultType("error");
      setMessage("ยังเรียงตัวอักษรไม่ถูก ลองฟังเสียงซ้ำ แล้วจัดตัวอักษรใหม่อีกครั้ง");
      return;
    }

    if (!written) {
      setResultType("error");
      setMessage("เรียงถูกแล้ว! เขียนคำศัพท์ลงบนกระดานอีกนิด เพื่อรับ 1 คะแนน");
      return;
    }

    await awardPoint();

    setResultType("success");
    setMessage("เก่งมาก! เรียงถูกและเขียนแล้ว ได้ 1 คะแนน");

    window.setTimeout(() => {
      nextWord();
    }, 1300);
  }

  async function awardPoint() {
    if (!user || !profile) return;

    const userRef = doc(db, "users", user.uid);
    const publicRef = doc(db, "publicProfiles", user.uid);
    const historyRef = collection(db, "users", user.uid, "history");

    await updateDoc(userRef, {
      coins: increment(1),
      totalCorrect: increment(1),
      updatedAt: serverTimestamp(),
    });

    await setDoc(
      publicRef,
      {
        uid: user.uid,
        name: profile.name,
        className: profile.className,
        avatar: profile.avatar,
        coins: increment(1),
        totalCorrect: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await addDoc(historyRef, {
      word: currentWord.word,
      language,
      earnedCoin: 1,
      createdAt: serverTimestamp(),
    });
  }

  async function buyReward(item: RewardItem) {
    if (!user || !profile) return;

    if (profile.coins < item.price) {
      setMessage("คะแนนยังไม่พอสำหรับแลกรางวัลนี้");
      setActiveTab("shop");
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const publicRef = doc(db, "publicProfiles", user.uid);
    const rewardRef = doc(collection(db, "users", user.uid, "rewards"));

    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);

      if (!userSnap.exists()) {
        throw new Error("ไม่พบข้อมูลผู้ใช้");
      }

      const currentPoints = Number(userSnap.data().coins || 0);

      if (currentPoints < item.price) {
        throw new Error("คะแนนไม่พอ");
      }

      transaction.update(userRef, {
        coins: currentPoints - item.price,
        updatedAt: serverTimestamp(),
      });

      transaction.set(
        publicRef,
        {
          coins: currentPoints - item.price,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(rewardRef, {
        rewardId: item.id,
        name: item.name,
        price: item.price,
        icon: item.icon,
        createdAt: serverTimestamp(),
      });
    });

    setMessage(`แลกรางวัล ${item.name} สำเร็จแล้ว`);
  }

  async function saveProfile() {
    if (!user || !profile) return;

    const userRef = doc(db, "users", user.uid);
    const publicRef = doc(db, "publicProfiles", user.uid);

    await setDoc(
      userRef,
      {
        name: profileName,
        className: profileClass,
        avatar: profileAvatar,
        theme: profileTheme,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await setDoc(
      publicRef,
      {
        uid: user.uid,
        name: profileName,
        className: profileClass,
        avatar: profileAvatar,
        coins: profile.coins || 0,
        totalCorrect: profile.totalCorrect || 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setMessage("บันทึกโปรไฟล์เรียบร้อยแล้ว");
  }

  async function handleLogout() {
    await signOut(auth);
  }

  if (authLoading) {
    return (
      <div className="pageBg">
        <div className="loadingCard">กำลังโหลด...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  if (!profile) {
    return (
      <div className="pageBg">
        <div className="loadingCard">กำลังโหลดข้อมูลผู้ใช้...</div>
      </div>
    );
  }

  function renderLearnPage() {
    return (
      <>
        <div className="pageTitle">ฝึกฟัง เรียงคำ และเขียน</div>

        <div className="langSwitch">
          <button
            className={`langBtn ${language === "en" ? "active" : ""}`}
            onClick={() => switchLanguage("en")}
          >
            ภาษาอังกฤษ
          </button>

          <button
            className={`langBtn ${language === "th" ? "active" : ""}`}
            onClick={() => switchLanguage("th")}
          >
            ภาษาไทย
          </button>

          <button className="hintBtn" onClick={() => setShowAnswer((prev) => !prev)}>
            {showAnswer ? "ซ่อนคำเฉลย" : "ดูคำเฉลย"}
          </button>
        </div>

        {!hasStarted && (
          <div className="startCard">
            <button className="startBtn" onClick={startLesson}>
              ▶ เริ่มเรียน
            </button>
            <p>กดเริ่มเรียน 1 ครั้ง หลังจากนั้นเมื่อเปลี่ยนคำ ระบบจะอ่านเสียงให้อัตโนมัติ</p>
          </div>
        )}

        <section className="soundHero">
          <div className="soundCircle">🔊</div>

          <div className="soundContent">
            <div className="soundTitle">โจทย์เสียง</div>
            <div className="soundDesc">
              ฟังเสียง แล้วเรียงตัวอักษรให้ถูก จากนั้นเขียนคำศัพท์บนกระดาน
            </div>

            {showAnswer ? (
              <div className="answerReveal">
                <span>{currentWord.word}</span>
                <small>{currentWord.meaning}</small>
              </div>
            ) : (
              <div className="hiddenAnswer">คำนี้มี {wordUnits.length} ช่อง</div>
            )}
          </div>

          <button className="soundBtn" onClick={speakWord}>
            ฟังเสียงซ้ำ
          </button>
        </section>

        <section className="answerBoard">
          <div className="sectionHeader">
            <div>
              <h3>1) เรียงตัวอักษร</h3>
              <p>แตะตัวอักษรจากถาด เพื่อวางในช่องคำตอบ</p>
            </div>
            <button className="ghostBtn" onClick={clearLetters}>
              ล้างตัวอักษร
            </button>
          </div>

          <div className="slotsRow">
            {wordUnits.map((_, index) => (
              <button
                key={`slot-${index}`}
                className={`answerSlot ${answerSlots[index] ? "filled" : ""}`}
                onClick={() => removeSlot(index)}
              >
                {answerSlots[index]?.value || ""}
              </button>
            ))}
          </div>

          <div className="trayPanel">
            <div className="trayTitle">ถาดตัวอักษร</div>
            <div className="letterTray">
              {letterTray.map((tile) => (
                <button key={tile.id} className="letterTile" onClick={() => selectTile(tile)}>
                  {tile.value}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="writingPanel">
          <div className="sectionHeader">
            <div>
              <h3>2) เขียนคำศัพท์</h3>
              <p>เขียนด้วยนิ้ว ปากกา tablet หรือเมาส์</p>
            </div>
            <button className="ghostBtn" onClick={clearWriting}>
              ล้างกระดาน
            </button>
          </div>

          <div className="writingBox" ref={writingBoxRef}>
            <SignatureCanvas
              ref={writingPadRef}
              penColor="#111827"
              minWidth={3}
              maxWidth={7}
              onEnd={() => {
                setWritingTick((prev) => prev + 1);
              }}
              canvasProps={{
                className: "writingCanvas",
              }}
            />
          </div>
        </section>

        <section className="statusGrid">
          <div
            className={`resultBox ${
              resultType === "success" ? "success" : resultType === "error" ? "error" : "neutral"
            }`}
          >
            <div className="resultIcon">
              {resultType === "success" ? "⭐" : resultType === "error" ? "🙂" : "✨"}
            </div>
            <div className="resultTitle">
              {resultType === "success"
                ? "ได้คะแนน!"
                : resultType === "error"
                  ? "ลองอีกครั้ง"
                  : "พร้อมตรวจ"}
            </div>
            <div className="resultText">{message}</div>
          </div>

          <div className="checkPanel">
            <div className="miniStatus">
              <span>เรียงครบ</span>
              <b>{isArrangeComplete ? "ผ่าน" : "ยังไม่ครบ"}</b>
            </div>

            <div className="miniStatus">
              <span>เรียงถูก</span>
              <b>{isArrangeCorrect ? "ถูก" : "รอตรวจ"}</b>
            </div>

            <div className="miniStatus">
              <span>เขียนแล้ว</span>
              <b>{hasWritten ? "เขียนแล้ว" : "ยังไม่ได้เขียน"}</b>
            </div>

            <button className="checkBtn" onClick={checkAnswer}>
              ตรวจคำตอบ
            </button>
          </div>
        </section>

        <div className="actionRow">
          <button className="smallBtn" onClick={prevWord}>
            ⬅ คำก่อนหน้า
          </button>
          <button className="smallBtn" onClick={nextWord}>
            คำถัดไป ➡
          </button>
        </div>
      </>
    );
  }

  function renderScorePage() {
    return (
      <div className="simplePage">
        <h2>คะแนนของฉัน</h2>

        <div className="scoreCards">
          <div className="bigScoreCard">⭐ {profile.coins || 0} คะแนน</div>
          <div className="bigScoreCard">✅ ถูกทั้งหมด {profile.totalCorrect || 0} คำ</div>
          <div className="bigScoreCard">🎁 รางวัล {myRewards.length} ชิ้น</div>
        </div>

        <h3 className="sectionTitle">อันดับเพื่อน</h3>
        <div className="leaderboard">
          {leaderboard.map((item, index) => (
            <div key={item.uid} className={item.uid === user.uid ? "me" : ""}>
              {index + 1}. {item.avatar} {item.name} — {item.coins} คะแนน
            </div>
          ))}
        </div>

        <h3 className="sectionTitle">ประวัติล่าสุด</h3>
        <div className="historyList">
          {history.length === 0 && <div className="emptyText">ยังไม่มีประวัติการฝึก</div>}

          {history.map((item, index) => (
            <div key={index} className="historyItem">
              <span>{item.language === "en" ? "EN" : "TH"}</span>
              <b>{item.word}</b>
              <em>+{item.earnedCoin} คะแนน</em>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderShopPage() {
    return (
      <div className="simplePage">
        <h2>ร้านของรางวัล</h2>
        <p className="shopIntro">คะแนนของฉัน: {profile.coins || 0} คะแนน</p>

        <div className="shopGrid">
          {SHOP_ITEMS.map((item) => (
            <div className="shopItem" key={item.id}>
              <div className="shopEmoji">{item.icon}</div>
              <h3>{item.name}</h3>
              <p>{item.price} คะแนน</p>
              <button onClick={() => buyReward(item)}>แลกรางวัล</button>
            </div>
          ))}
        </div>

        <h3 className="sectionTitle">รางวัลของฉัน</h3>
        <div className="rewardList">
          {myRewards.length === 0 && <div className="emptyText">ยังไม่มีรางวัล</div>}

          {myRewards.map((item, index) => (
            <div className="rewardBadge" key={index}>
              {item.icon} {item.name}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderProfilePage() {
    return (
      <div className="simplePage">
        <h2>โปรไฟล์</h2>

        <div className="profileCard">
          <div className="profileAvatar">{profileAvatar}</div>

          <div className="profileFields">
            <label>ชื่อของฉัน</label>
            <input value={profileName} onChange={(e) => setProfileName(e.target.value)} />

            <label>ห้องเรียน</label>
            <input value={profileClass} onChange={(e) => setProfileClass(e.target.value)} />

            <label>เลือก Avatar</label>
            <div className="avatarOptions">
              {AVATARS.map((avatar) => (
                <button
                  key={avatar}
                  className={profileAvatar === avatar ? "selectedAvatar" : ""}
                  onClick={() => setProfileAvatar(avatar)}
                >
                  {avatar}
                </button>
              ))}
            </div>

            <label>เปลี่ยนธีมสี</label>
            <div className="themeDots">
              {THEMES.map((theme) => (
                <button
                  key={theme}
                  className={`${theme} ${profileTheme === theme ? "selectedTheme" : ""}`}
                  onClick={() => setProfileTheme(theme)}
                ></button>
              ))}
            </div>

            <button className="saveProfileBtn" onClick={saveProfile}>
              บันทึกโปรไฟล์
            </button>

            <button className="logoutBtn" onClick={handleLogout}>
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`pageBg theme-${profile.theme || "blue"}`}>
      <div className="browserFrame">
        <div className="browserTop">
          <div className="browserDots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="browserUrl">app.wordstarkids.com</div>
        </div>

        <div className="appShell">
          <header className="topBar">
            <div className="brand">Word Star Kids</div>

            <div className="topRight">
              <div className="coinPill">⭐ {profile.coins || 0} คะแนน</div>
              <div className="avatarMini">{profile.avatar || "🧒"}</div>
            </div>
          </header>

          <main className="mainCard">
            {activeTab === "learn" && renderLearnPage()}
            {activeTab === "score" && renderScorePage()}
            {activeTab === "shop" && renderShopPage()}
            {activeTab === "profile" && renderProfilePage()}
          </main>

          <nav className="bottomNav">
            <button
              className={`navItem ${activeTab === "learn" ? "active" : ""}`}
              onClick={() => setActiveTab("learn")}
            >
              📘 เรียน
            </button>

            <button
              className={`navItem ${activeTab === "score" ? "active" : ""}`}
              onClick={() => setActiveTab("score")}
            >
              🏆 คะแนน
            </button>

            <button
              className={`navItem ${activeTab === "shop" ? "active" : ""}`}
              onClick={() => setActiveTab("shop")}
            >
              🎁 ร้านค้า
            </button>

            <button
              className={`navItem ${activeTab === "profile" ? "active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              👤 โปรไฟล์
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [className, setClassName] = useState("ป.1/1");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        const userRef = doc(db, "users", uid);
        const publicRef = doc(db, "publicProfiles", uid);

        const displayName = name || email.split("@")[0];

        await setDoc(userRef, {
          uid,
          email,
          name: displayName,
          className,
          avatar: "🧒",
          theme: "blue",
          coins: 0,
          totalCorrect: 0,
          createdAt: serverTimestamp(),
        });

        await setDoc(publicRef, {
          uid,
          name: displayName,
          className,
          avatar: "🧒",
          coins: 0,
          totalCorrect: 0,
          updatedAt: serverTimestamp(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาด");
    }
  }

  return (
    <div className="pageBg">
      <div className="authCard">
        <h1>Word Star Kids</h1>
        <p>เข้าสู่ระบบเพื่อเก็บคะแนนและแข่งกับเพื่อน</p>

        <div className="authSwitch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        {mode === "register" && (
          <>
            <label>ชื่อเด็ก</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น น้องต้นกล้า" />

            <label>ห้องเรียน</label>
            <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="เช่น ป.1/1" />
          </>
        )}

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="เช่น tongkla01@wordstar.local" />

        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />

        {error && <div className="authError">{error}</div>}

        <button className="authSubmit" onClick={handleSubmit}>
          {mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>

        <div className="authHint">
          ช่วงทดลองสามารถใช้ email สมมติได้ เช่น pond01@wordstar.local และ password อย่างน้อย 6 ตัว
        </div>
      </div>
    </div>
  );
}

export default App;