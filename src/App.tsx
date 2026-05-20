import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
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

type ThemeKey = "yellowBunny" | "redBlockman" | "blueSponge";
type LangKey = "en" | "th";
type TabKey = "learn" | "score" | "shop" | "profile";
type AuthMode = "login" | "register";
type CheckState = "idle" | "success" | "error";

interface WordItem {
  id: string;
  text: string;
  meaning: string;
  lang: LangKey;
}

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  className: string;
  coins: number;
  totalCorrect: number;
  theme: ThemeKey;
  avatarEmoji: string;
  completedWords: string[];
  claimedRewardIds: string[];
}

interface PublicProfile {
  uid: string;
  name: string;
  className: string;
  coins: number;
  totalCorrect: number;
  theme: ThemeKey;
  avatarEmoji: string;
}

interface RewardItem {
  id: string;
  title: string;
  cost: number;
  emoji: string;
}

const ENGLISH_WORDS: WordItem[] = [
  { id: "en-1", text: "hello", meaning: "สวัสดี", lang: "en" },
  { id: "en-2", text: "name", meaning: "ชื่อ", lang: "en" },
  { id: "en-3", text: "my", meaning: "ของฉัน", lang: "en" },
  { id: "en-4", text: "your", meaning: "ของคุณ", lang: "en" },
  { id: "en-5", text: "pencil", meaning: "ดินสอ", lang: "en" },
  { id: "en-6", text: "pen", meaning: "ปากกา", lang: "en" },
  { id: "en-7", text: "bag", meaning: "กระเป๋า", lang: "en" },
  { id: "en-8", text: "book", meaning: "หนังสือ", lang: "en" },
  { id: "en-9", text: "desk", meaning: "โต๊ะเรียน", lang: "en" },
  { id: "en-10", text: "chair", meaning: "เก้าอี้", lang: "en" },
  { id: "en-11", text: "ruler", meaning: "ไม้บรรทัด", lang: "en" },
  { id: "en-12", text: "eraser", meaning: "ยางลบ", lang: "en" },
  { id: "en-13", text: "map", meaning: "แผนที่", lang: "en" },
  { id: "en-14", text: "marker", meaning: "ปากกาเมจิก", lang: "en" },
  { id: "en-15", text: "globe", meaning: "ลูกโลก", lang: "en" },
];

const THAI_WORDS: WordItem[] = [
  { id: "th-1", text: "กา", meaning: "กา", lang: "th" },
  { id: "th-2", text: "กิน", meaning: "กิน", lang: "th" },
  { id: "th-3", text: "ไก่", meaning: "ไก่", lang: "th" },
  { id: "th-4", text: "เก้า", meaning: "เก้า", lang: "th" },
  { id: "th-5", text: "เก็บ", meaning: "เก็บ", lang: "th" },
  { id: "th-6", text: "เก่ง", meaning: "เก่ง", lang: "th" },
  { id: "th-7", text: "ขา", meaning: "ขา", lang: "th" },
  { id: "th-8", text: "ของ", meaning: "ของ", lang: "th" },
  { id: "th-9", text: "เข่า", meaning: "เข่า", lang: "th" },
  { id: "th-10", text: "ข้าง", meaning: "ข้าง", lang: "th" },
  { id: "th-11", text: "เขี่ย", meaning: "เขี่ย", lang: "th" },
  { id: "th-12", text: "ขวา", meaning: "ขวา", lang: "th" },
  { id: "th-13", text: "คำ", meaning: "คำ", lang: "th" },
  { id: "th-14", text: "คน", meaning: "คน", lang: "th" },
  { id: "th-15", text: "คืน", meaning: "คืน", lang: "th" },
  { id: "th-16", text: "ครู", meaning: "ครู", lang: "th" },
  { id: "th-17", text: "คุย", meaning: "คุย", lang: "th" },
  { id: "th-18", text: "คิด", meaning: "คิด", lang: "th" },
  { id: "th-19", text: "งา", meaning: "งา", lang: "th" },
  { id: "th-20", text: "งวง", meaning: "งวง", lang: "th" },
];

const THEME_OPTIONS: {
  key: ThemeKey;
  title: string;
  short: string;
  emoji: string;
  description: string;
  cssClass: string;
}[] = [
  {
    key: "yellowBunny",
    title: "กระต่ายเหลือง",
    short: "Bunny",
    emoji: "🐰",
    description: "โทนเหลืองน่ารัก สดใส เหมาะกับเด็กเล็ก",
    cssClass: "theme-yellow-bunny",
  },
  {
    key: "redBlockman",
    title: "มนุษย์กล่อง แดง",
    short: "Block",
    emoji: "🧱",
    description: "โลกบล็อกผจญภัย สีแดงส้ม สนุก ตื่นเต้น",
    cssClass: "theme-red-blockman",
  },
  {
    key: "blueSponge",
    title: "มนุษย์ฟองน้ำ ฟ้า",
    short: "Ocean",
    emoji: "🌊",
    description: "โลกใต้ทะเลสีฟ้า สดใส มีชีวิตชีวา",
    cssClass: "theme-blue-sponge",
  },
];

const AVATAR_OPTIONS = ["👦", "👧", "🧒", "🐰", "🦊", "🐼", "🐥", "⭐", "🚀", "🧸"];

const REWARD_ITEMS: RewardItem[] = [
  { id: "reward-100", title: "โหลด 1 เกมส์", cost: 100, emoji: "🎮" },
  { id: "reward-200", title: "กินสุกี้ BONUS", cost: 200, emoji: "🍲" },
  { id: "reward-300", title: "ได้ของเล่น 1 ชิ้น", cost: 300, emoji: "🧸" },
];

const DEFAULT_THEME: ThemeKey = "yellowBunny";

function normalizeTheme(value: unknown): ThemeKey {
  if (value === "yellowBunny" || value === "redBlockman" || value === "blueSponge") {
    return value;
  }

  if (value === "pinkRabbit") return "yellowBunny";
  if (value === "minecraft") return "redBlockman";
  if (value === "spongeSea") return "blueSponge";
  if (value === "snowPrincess") return "blueSponge";

  return DEFAULT_THEME;
}

function normalizeWord(word: string, lang: LangKey) {
  const clean = word.replace(/\s+/g, "");
  return lang === "en" ? clean.toLowerCase() : clean;
}

function splitChars(word: string) {
  return Array.from(word);
}

function shuffleArray<T>(items: T[]) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

function buildLetterBank(word: string, lang: LangKey) {
  const answerChars = splitChars(normalizeWord(word, lang));
  const enExtras = splitChars("abcdefghijklmnopqrstuvwxyz");
  const thExtras = splitChars("กขคงจฉชซดตถทธนบปผพฟมยรลวสหอาเแโใไ่้");
  const extrasSource = lang === "en" ? enExtras : thExtras;
  const extras: string[] = [];

  while (extras.length < Math.min(5, Math.max(3, answerChars.length))) {
    const randomChar = extrasSource[Math.floor(Math.random() * extrasSource.length)];

    if (!answerChars.includes(randomChar) && !extras.includes(randomChar)) {
      extras.push(randomChar);
    }
  }

  return shuffleArray([...answerChars, ...extras]);
}

function getWordKey(item: WordItem) {
  return `${item.lang}:${item.id}:${normalizeWord(item.text, item.lang)}`;
}

function createDefaultProfile(currentUser: User): UserProfile {
  const email = currentUser.email || "";
  const name = email ? email.split("@")[0] : "เด็กน้อย";

  return {
    uid: currentUser.uid,
    email,
    name,
    className: "ป.1/1",
    coins: 0,
    totalCorrect: 0,
    theme: DEFAULT_THEME,
    avatarEmoji: "🧒",
    completedWords: [],
    claimedRewardIds: [],
  };
}

function mergeProfile(rawData: Partial<UserProfile>, currentUser: User): UserProfile {
  const fallback = createDefaultProfile(currentUser);

  return {
    uid: currentUser.uid,
    email: rawData.email || fallback.email,
    name: rawData.name || fallback.name,
    className: rawData.className || fallback.className,
    coins: Number(rawData.coins || 0),
    totalCorrect: Number(rawData.totalCorrect || 0),
    theme: normalizeTheme(rawData.theme),
    avatarEmoji: rawData.avatarEmoji || "🧒",
    completedWords: Array.isArray(rawData.completedWords) ? rawData.completedWords : [],
    claimedRewardIds: Array.isArray(rawData.claimedRewardIds) ? rawData.claimedRewardIds : [],
  };
}

function App() {
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [registerName, setRegisterName] = useState("");
  const [registerClassName, setRegisterClassName] = useState("ป.1/1");
  const [email, setEmail] = useState("pond01@wordstar.local");
  const [password, setPassword] = useState("123456");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("learn");
  const [language, setLanguage] = useState<LangKey>("en");
  const [wordIndex, setWordIndex] = useState(0);
  const [letterBank, setLetterBank] = useState<string[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [feedback, setFeedback] = useState("เรียงตัวอักษรและเขียนคำศัพท์ แล้วกดตรวจคำตอบ");
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [showAnswer, setShowAnswer] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PublicProfile[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  const currentWords = language === "en" ? ENGLISH_WORDS : THAI_WORDS;
  const currentWord = currentWords[wordIndex] || currentWords[0];

  const expectedChars = useMemo(() => {
    return splitChars(normalizeWord(currentWord.text, currentWord.lang));
  }, [currentWord]);

  const selectedText = selectedIndices.map((index) => letterBank[index]).join("");
  const normalizedSelectedText = language === "en" ? selectedText.toLowerCase() : selectedText;

  const currentTheme = useMemo(() => {
    const key = profile ? normalizeTheme(profile.theme) : DEFAULT_THEME;
    return THEME_OPTIONS.find((item) => item.key === key) || THEME_OPTIONS[0];
  }, [profile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (!firebaseUser) {
        setProfile(null);
        return;
      }

      setProfileLoading(true);

      try {
        const userRef = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const profileData = mergeProfile(snap.data() as Partial<UserProfile>, firebaseUser);
          setProfile(profileData);

          await setDoc(userRef, profileData, { merge: true });
          await upsertPublicProfile(profileData);
        } else {
          const newProfile = createDefaultProfile(firebaseUser);

          await setDoc(userRef, {
            ...newProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          await upsertPublicProfile(newProfile);
          setProfile(newProfile);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "publicProfiles"), orderBy("coins", "desc"), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: PublicProfile[] = snapshot.docs.map((item) => {
        const data = item.data() as Partial<PublicProfile>;

        return {
          uid: item.id,
          name: data.name || "เด็กน้อย",
          className: data.className || "",
          coins: Number(data.coins || 0),
          totalCorrect: Number(data.totalCorrect || 0),
          theme: normalizeTheme(data.theme),
          avatarEmoji: data.avatarEmoji || "🧒",
        };
      });

      setLeaderboard(items);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentWord) return;

    setLetterBank(buildLetterBank(currentWord.text, currentWord.lang));
    setSelectedIndices([]);
    setFeedback("ฟังเสียง → เรียงตัวอักษร → เขียนคำศัพท์ → กดตรวจคำตอบ");
    setCheckState("idle");
    setShowAnswer(false);
    clearCanvas();

    const timer = window.setTimeout(() => {
      speakWord(currentWord.text, currentWord.lang);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [currentWord]);

  useEffect(() => {
    setupCanvas();

    const onResize = () => {
      setupCanvas();
    };

    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab]);

  async function upsertPublicProfile(nextProfile: UserProfile) {
    await setDoc(
      doc(db, "publicProfiles", nextProfile.uid),
      {
        uid: nextProfile.uid,
        name: nextProfile.name,
        className: nextProfile.className,
        coins: nextProfile.coins,
        totalCorrect: nextProfile.totalCorrect,
        theme: normalizeTheme(nextProfile.theme),
        avatarEmoji: nextProfile.avatarEmoji || "🧒",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function saveProfilePatch(patch: Partial<UserProfile>) {
    if (!user || !profile) return;

    const nextProfile: UserProfile = {
      ...profile,
      ...patch,
      theme: patch.theme ? normalizeTheme(patch.theme) : normalizeTheme(profile.theme),
    };

    setProfile(nextProfile);

    await setDoc(
      doc(db, "users", user.uid),
      {
        ...patch,
        theme: nextProfile.theme,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await upsertPublicProfile(nextProfile);
  }

  async function handleAuthSubmit() {
    try {
      setAuthError("");

      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        return;
      }

      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const newProfile: UserProfile = {
        uid: credential.user.uid,
        email: email.trim(),
        name: registerName.trim() || email.split("@")[0] || "เด็กน้อย",
        className: registerClassName.trim() || "ป.1/1",
        coins: 0,
        totalCorrect: 0,
        theme: DEFAULT_THEME,
        avatarEmoji: "🧒",
        completedWords: [],
        claimedRewardIds: [],
      };

      await setDoc(doc(db, "users", credential.user.uid), {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await upsertPublicProfile(newProfile);
      setProfile(newProfile);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ";
      setAuthError(message);
    }
  }

  function speakWord(text: string, lang: LangKey) {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = lang === "en" ? "en-US" : "th-TH";
    speech.rate = lang === "en" ? 0.82 : 0.9;
    speech.pitch = 1;

    window.speechSynthesis.speak(speech);
  }

  function setupCanvas() {
    const canvas = canvasRef.current;
    const wrap = canvasWrapRef.current;

    if (!canvas || !wrap) return;

    const rect = wrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 6;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) {
      hasDrawnRef.current = false;
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      hasDrawnRef.current = false;
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  }

  function getPointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const { x, y } = getPointerPosition(event);

    ctx.beginPath();
    ctx.moveTo(x, y);

    isDrawingRef.current = true;
    hasDrawnRef.current = true;

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!canvas || !ctx) return;

    const { x, y } = getPointerPosition(event);

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    isDrawingRef.current = false;

    try {
      canvas?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function handlePickLetter(index: number) {
    if (selectedIndices.includes(index)) return;
    if (selectedIndices.length >= expectedChars.length) return;

    setSelectedIndices((prev) => [...prev, index]);
    setCheckState("idle");
    setFeedback("ดีมาก เรียงต่อให้ครบ แล้วเขียนคำศัพท์ลงกระดาน");
  }

  function handleRemoveLastLetter() {
    setSelectedIndices((prev) => prev.slice(0, -1));
    setCheckState("idle");
  }

  function handleResetLetters() {
    setSelectedIndices([]);
    setCheckState("idle");
    setFeedback("ล้างคำแล้ว ลองเรียงใหม่อีกครั้ง");
  }

  async function handleCheckAnswer() {
    if (!profile || !user) return;

    const expected = normalizeWord(currentWord.text, currentWord.lang);
    const wordKey = getWordKey(currentWord);

    if (!hasDrawnRef.current) {
      setCheckState("error");
      setFeedback("ต้องลองเขียนคำนี้ในช่องก่อน แล้วค่อยตรวจคำตอบ");
      return;
    }

    if (normalizedSelectedText !== expected) {
      setCheckState("error");
      setFeedback("เรียงตัวอักษรยังไม่ถูก ลองฟังเสียงซ้ำ แล้วเรียงใหม่อีกครั้ง");
      return;
    }

    if (profile.completedWords.includes(wordKey)) {
      setCheckState("success");
      setFeedback("เก่งมาก! คำนี้เคยได้คะแนนแล้ว แต่ยังฝึกซ้ำได้");
      return;
    }

    const nextCompletedWords = [...profile.completedWords, wordKey];
    const nextCoins = profile.coins + 1;
    const nextTotalCorrect = profile.totalCorrect + 1;

    await updateDoc(doc(db, "users", user.uid), {
      coins: increment(1),
      totalCorrect: increment(1),
      completedWords: nextCompletedWords,
      updatedAt: serverTimestamp(),
    });

    const nextProfile = {
      ...profile,
      coins: nextCoins,
      totalCorrect: nextTotalCorrect,
      completedWords: nextCompletedWords,
    };

    setProfile(nextProfile);
    await upsertPublicProfile(nextProfile);

    setCheckState("success");
    setFeedback("ถูกต้อง! ได้ 1 คะแนน 🎉");

    window.setTimeout(() => {
      handleNextWord();
    }, 1100);
  }

  async function handleThemeChange(theme: ThemeKey) {
    setSavingProfile(true);

    try {
      await saveProfilePatch({ theme });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarChange(avatarEmoji: string) {
    await saveProfilePatch({ avatarEmoji });
  }

  async function handleProfileSave() {
    if (!profile) return;

    setSavingProfile(true);

    try {
      await saveProfilePatch({
        name: profile.name,
        className: profile.className,
      });

      alert("บันทึกโปรไฟล์เรียบร้อยแล้ว");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleClaimReward(rewardId: string) {
    if (!profile || !user) return;

    const reward = REWARD_ITEMS.find((item) => item.id === rewardId);

    if (!reward) return;

    if (profile.claimedRewardIds.includes(rewardId)) {
      alert("รับรางวัลนี้ไปแล้ว");
      return;
    }

    if (profile.coins < reward.cost) {
      alert(`ยังมีคะแนนไม่พอ ต้องมีอย่างน้อย ${reward.cost} คะแนน`);
      return;
    }

    const userRef = doc(db, "users", user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(userRef);

        if (!snap.exists()) {
          throw new Error("ไม่พบข้อมูลผู้ใช้");
        }

        const data = snap.data() as Partial<UserProfile>;
        const currentCoins = Number(data.coins || 0);
        const currentRewardIds = Array.isArray(data.claimedRewardIds) ? data.claimedRewardIds : [];

        if (currentCoins < reward.cost) {
          throw new Error("คะแนนไม่พอ");
        }

        transaction.update(userRef, {
          coins: currentCoins - reward.cost,
          claimedRewardIds: [...currentRewardIds, rewardId],
          updatedAt: serverTimestamp(),
        });
      });

      const nextProfile = {
        ...profile,
        coins: profile.coins - reward.cost,
        claimedRewardIds: [...profile.claimedRewardIds, rewardId],
      };

      setProfile(nextProfile);
      await upsertPublicProfile(nextProfile);

      alert(`รับรางวัล "${reward.title}" เรียบร้อยแล้ว`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "แลกรางวัลไม่สำเร็จ";
      alert(message);
    }
  }

  function handleNextWord() {
    setWordIndex((prev) => (prev + 1) % currentWords.length);
  }

  function handlePrevWord() {
    setWordIndex((prev) => (prev - 1 + currentWords.length) % currentWords.length);
  }

  async function handleLogout() {
    await signOut(auth);
    setActiveTab("learn");
    setProfile(null);
  }

  function getRank() {
    if (!user) return "-";

    const index = leaderboard.findIndex((item) => item.uid === user.uid);

    if (index === -1) return "-";

    return `#${index + 1}`;
  }

  if (authLoading || profileLoading) {
    return (
      <div className="loadingScreen">
        <div className="loadingCard">
          <div className="loadingEmoji">⭐</div>
          <h2>กำลังโหลด Word Star Kids...</h2>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="authPage">
        <div className="authCard">
          <div className="authBrand">Word Star Kids</div>
          <p className="authSub">เข้าสู่ระบบเพื่อเก็บคะแนนและแข่งกับเพื่อน</p>

          <div className="authSwitch">
            <button
              className={authMode === "login" ? "authSwitchBtn active" : "authSwitchBtn"}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Login
            </button>

            <button
              className={authMode === "register" ? "authSwitchBtn active" : "authSwitchBtn"}
              onClick={() => setAuthMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          {authMode === "register" && (
            <>
              <label>ชื่อเด็ก</label>
              <input
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="เช่น น้องต้นกล้า"
              />

              <label>ห้องเรียน</label>
              <input
                value={registerClassName}
                onChange={(e) => setRegisterClassName(e.target.value)}
                placeholder="เช่น ป.1/1"
              />
            </>
          )}

          <label>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="เช่น pond01@wordstar.local"
          />

          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />

          {authError && <div className="authError">{authError}</div>}

          <button className="authSubmit" onClick={handleAuthSubmit} type="button">
            {authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>

          <div className="authHint">
            ช่วงทดลองสามารถใช้ email สมมติได้ เช่น pond01@wordstar.local และ password อย่างน้อย 6 ตัว
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`appShell ${currentTheme.cssClass}`}>
      <div className="appOverlay" />

      <div className="appContainer">
        <header className="topBar glassCard">
          <div>
            <div className="brandTitle">Word Star Kids</div>
            <div className="brandSub">เรียนคำศัพท์ • สนุกทุกวัน • เก่งขึ้นทุกวัน</div>
          </div>

          <div className="topBarRight">
            <div className="coinBadge">🪙 {profile.coins}</div>
            <div className="rankBadge">🏆 {getRank()}</div>
            <div className="avatarBadge">{profile.avatarEmoji || "🧒"}</div>
          </div>
        </header>

        <main className="mainContent">
          {activeTab === "learn" && (
            <section className="screenCard lessonScreen">
              <div className="sectionTitle">ฝึกเขียนคำศัพท์</div>

              <div className="languageTabs">
                <button
                  className={language === "en" ? "langBtn active" : "langBtn"}
                  onClick={() => {
                    setLanguage("en");
                    setWordIndex(0);
                  }}
                  type="button"
                >
                  GB ภาษาอังกฤษ
                </button>

                <button
                  className={language === "th" ? "langBtn active" : "langBtn"}
                  onClick={() => {
                    setLanguage("th");
                    setWordIndex(0);
                  }}
                  type="button"
                >
                  TH ภาษาไทย
                </button>

                <button
                  className={showAnswer ? "langBtn answer active" : "langBtn answer"}
                  onClick={() => setShowAnswer((prev) => !prev)}
                  type="button"
                >
                  {showAnswer ? "ซ่อนเฉลย" : "ดูคำเฉลย"}
                </button>
              </div>

              <div className="heroPrompt glassCard">
                <div className="heroPromptIcon">{currentTheme.emoji}</div>

                <div className="heroPromptCenter">
                  <div className="bigQuestion">{showAnswer ? currentWord.text : "?"}</div>
                  <div className="heroPromptText">
                    ฟังเสียง → เรียงตัวอักษร → เขียนคำนี้ลงในช่อง
                  </div>
                  <div className="wordMeaning">{showAnswer ? currentWord.meaning : ""}</div>
                </div>

                <button
                  className="speakButton"
                  onClick={() => speakWord(currentWord.text, currentWord.lang)}
                  type="button"
                >
                  🔊 ฟังเสียง
                </button>
              </div>

              <div className="lessonGrid">
                <div className="leftColumn">
                  <div className="practiceCard glassCard">
                    <div className="cardTitle">1) เรียงตัวอักษรให้ถูกต้อง</div>

                    <div className="answerSlots">
                      {expectedChars.map((_, slotIndex) => (
                        <div className="answerSlot" key={`slot-${slotIndex}`}>
                          {selectedIndices[slotIndex] !== undefined ? letterBank[selectedIndices[slotIndex]] : ""}
                        </div>
                      ))}
                    </div>

                    <div className="letterTray">
                      {letterBank.map((char, index) => {
                        const used = selectedIndices.includes(index);

                        return (
                          <button
                            key={`${char}-${index}`}
                            className={used ? "letterButton used" : "letterButton"}
                            onClick={() => handlePickLetter(index)}
                            disabled={used}
                            type="button"
                          >
                            {char}
                          </button>
                        );
                      })}
                    </div>

                    <div className="miniControls">
                      <button className="miniBtn" onClick={handleRemoveLastLetter} type="button">
                        ↩ ลบตัวท้าย
                      </button>

                      <button className="miniBtn" onClick={handleResetLetters} type="button">
                        🧽 ล้างคำ
                      </button>
                    </div>
                  </div>

                  <div className="practiceCard glassCard">
                    <div className="cardTitle">2) เขียนคำศัพท์ตรงนี้</div>

                    <div className="writingPad" ref={canvasWrapRef}>
                      <div className="writingLines" />

                      <canvas
                        ref={canvasRef}
                        className="writingCanvas"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                      />

                      <button className="clearCanvasBtn" onClick={clearCanvas} type="button">
                        ✏️ ล้างเส้น
                      </button>
                    </div>

                    <div className="actionRow">
                      <button className="navBtn" onClick={handlePrevWord} type="button">
                        ← คำก่อนหน้า
                      </button>

                      <button className="checkBtn" onClick={handleCheckAnswer} type="button">
                        ✅ ตรวจคำตอบ
                      </button>

                      <button className="navBtn" onClick={handleNextWord} type="button">
                        คำถัดไป →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="rightColumn">
                  <div
                    className={
                      checkState === "success"
                        ? "resultCard success"
                        : checkState === "error"
                          ? "resultCard error"
                          : "resultCard"
                    }
                  >
                    <div className="resultEmoji">
                      {checkState === "success" ? "⭐" : checkState === "error" ? "🙂" : "✨"}
                    </div>

                    <div className="resultTitle">
                      {checkState === "success" ? "ยอดเยี่ยม!" : checkState === "error" ? "ลองอีกครั้ง" : "พร้อมตรวจ"}
                    </div>

                    <div className="resultText">{feedback}</div>
                  </div>

                  <div className="infoCard glassCard">
                    <div className="cardTitle">สถานะปัจจุบัน</div>
                    <div className="infoLine">ภาษา: {language === "en" ? "อังกฤษ" : "ไทย"}</div>
                    <div className="infoLine">
                      คำที่: {wordIndex + 1} / {currentWords.length}
                    </div>
                    <div className="infoLine">คะแนนของฉัน: {profile.coins} คะแนน</div>
                    <div className="infoLine">ธีม: {currentTheme.title}</div>
                  </div>

                  <div className="infoCard glassCard">
                    <div className="cardTitle">วิธีเล่น</div>
                    <ul className="tipsList">
                      <li>ระบบอ่านเสียงอัตโนมัติเมื่อเปลี่ยนคำ</li>
                      <li>กดตัวอักษรจากถาดให้เรียงเป็นคำที่ได้ยิน</li>
                      <li>เขียนคำลงในกระดานด้วยนิ้ว เมาส์ หรือปากกา</li>
                      <li>เรียงถูก + เขียนแล้ว จะได้ 1 คะแนน</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "score" && (
            <section className="screenCard">
              <div className="sectionTitle">คะแนนของฉัน</div>

              <div className="scoreTopRow">
                <div className="scoreBox glassCard">
                  <div className="scoreIcon">🪙</div>
                  <div className="scoreLabel">คะแนนปัจจุบัน</div>
                  <div className="scoreValue">{profile.coins}</div>
                </div>

                <div className="scoreBox glassCard">
                  <div className="scoreIcon">🏆</div>
                  <div className="scoreLabel">อันดับของฉัน</div>
                  <div className="scoreValue">{getRank()}</div>
                </div>
              </div>

              <div className="leaderboardCard glassCard">
                <div className="cardTitle">ตารางอันดับเพื่อน</div>

                <div className="leaderboardList">
                  {leaderboard.map((item, index) => {
                    const isMe = user.uid === item.uid;

                    return (
                      <div key={item.uid} className={isMe ? "leaderItem me" : "leaderItem"}>
                        <div className="leaderLeft">
                          <div className="leaderRank">{index + 1}</div>
                          <div className="leaderAvatar">{item.avatarEmoji || "🧒"}</div>

                          <div>
                            <div className="leaderName">
                              {item.name} {isMe ? "(ฉัน)" : ""}
                            </div>
                            <div className="leaderClass">{item.className || "ยังไม่ได้ระบุห้อง"}</div>
                          </div>
                        </div>

                        <div className="leaderCoins">{item.coins} คะแนน</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {activeTab === "shop" && (
            <section className="screenCard">
              <div className="sectionTitle">ร้านของรางวัล</div>

              <div className="shopGrid">
                {REWARD_ITEMS.map((reward) => {
                  const claimed = profile.claimedRewardIds.includes(reward.id);
                  const canClaim = profile.coins >= reward.cost && !claimed;

                  return (
                    <div key={reward.id} className="rewardCard glassCard">
                      <div className="rewardEmoji">{reward.emoji}</div>
                      <div className="rewardTitle">{reward.title}</div>
                      <div className="rewardCost">{reward.cost} คะแนน</div>

                      <button
                        className={claimed ? "rewardBtn done" : canClaim ? "rewardBtn" : "rewardBtn disabled"}
                        onClick={() => handleClaimReward(reward.id)}
                        disabled={!canClaim}
                        type="button"
                      >
                        {claimed ? "รับแล้ว" : canClaim ? "แลกรางวัล" : "คะแนนไม่พอ"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="shopNote glassCard">
                คะแนนของฉันตอนนี้: <strong>{profile.coins}</strong> คะแนน
              </div>
            </section>
          )}

          {activeTab === "profile" && (
            <section className="screenCard">
              <div className="sectionTitle">โปรไฟล์</div>

              <div className="profileGrid">
                <div className="profileMain glassCard">
                  <div className="profileHeader">
                    <div className="profileAvatarLarge">{profile.avatarEmoji || "🧒"}</div>

                    <div className="profileUploadBlock">
                      <div className="cardTitle">Avatar ของฉัน</div>

                      <div className="avatarChoices">
                        {AVATAR_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            className={profile.avatarEmoji === emoji ? "avatarChoice active" : "avatarChoice"}
                            onClick={() => handleAvatarChange(emoji)}
                            type="button"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <div className="smallHint">
                        ใช้ Avatar แทนการอัปโหลดรูป เพื่อให้ระบบไม่ต้องใช้ Firebase Storage และใช้งานฟรีได้ง่ายขึ้น
                      </div>
                    </div>
                  </div>

                  <div className="profileForm">
                    <label>ชื่อเด็ก</label>
                    <input
                      value={profile.name}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                      }
                    />

                    <label>ห้องเรียน</label>
                    <input
                      value={profile.className}
                      onChange={(e) =>
                        setProfile((prev) => (prev ? { ...prev, className: e.target.value } : prev))
                      }
                      placeholder="เช่น ป.1/1"
                    />

                    <label>Email</label>
                    <input value={profile.email} disabled />

                    <button className="saveProfileBtn" onClick={handleProfileSave} disabled={savingProfile} type="button">
                      {savingProfile ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                    </button>
                  </div>
                </div>

                <div className="themePanel glassCard">
                  <div className="cardTitle">เลือกธีมของฉัน</div>

                  <div className="themeList">
                    {THEME_OPTIONS.map((theme) => (
                      <button
                        key={theme.key}
                        className={profile.theme === theme.key ? "themeChoice active" : "themeChoice"}
                        onClick={() => handleThemeChange(theme.key)}
                        type="button"
                      >
                        <div className="themePreview">
                          <div className={`themeMini ${theme.cssClass}`} />
                        </div>

                        <div className="themeInfo">
                          <div className="themeName">
                            {theme.emoji} {theme.title}
                          </div>
                          <div className="themeDesc">{theme.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        <nav className="bottomNav glassCard">
          <button
            className={activeTab === "learn" ? "navItem active" : "navItem"}
            onClick={() => setActiveTab("learn")}
            type="button"
          >
            📘 เรียน
          </button>

          <button
            className={activeTab === "score" ? "navItem active" : "navItem"}
            onClick={() => setActiveTab("score")}
            type="button"
          >
            🏆 คะแนน
          </button>

          <button
            className={activeTab === "shop" ? "navItem active" : "navItem"}
            onClick={() => setActiveTab("shop")}
            type="button"
          >
            🎁 ร้านค้า
          </button>

          <button
            className={activeTab === "profile" ? "navItem active" : "navItem"}
            onClick={() => setActiveTab("profile")}
            type="button"
          >
            👤 โปรไฟล์
          </button>

          <button className="navItem logout" onClick={handleLogout} type="button">
            🚪 ออก
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;
