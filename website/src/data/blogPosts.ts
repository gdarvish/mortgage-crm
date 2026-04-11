export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  imageUrl: string;
  author: string;
  authorRole: string;
  date: string;
  featured?: boolean;
}

export const defaultPosts: BlogPost[] = [
  {
    id: "1",
    title: "עתיד הנדל\"ן בישראל: לאן פנינו מועדות?",
    excerpt: "ניתוח מעמיק של השפעות הריבית, התחלות הבנייה והשינויים הדמוגרפיים הצפויים בשוק הדיור.",
    content: "שוק הנדל\"ן בישראל נמצא בצומת דרכים מעניין. מצד אחד, הריבית העולה מקשה על רוכשי דירות חדשים, ומצד שני, הביקוש ההולך וגדל ממשיך לתמוך במחירים. בניתוח זה נבחן את המגמות העיקריות שיעצבו את שוק הנדל\"ן בשנים הקרובות.",
    category: "מגמות שוק",
    imageUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80",
    author: "אבי כהן",
    authorRole: "מומחה לכלכלת המשפחה",
    date: "2024-12-15",
    featured: true,
  },
  {
    id: "2",
    title: "איך להוריד את הריבית על המשכנתא שלכם?",
    excerpt: "מדריך מעשי לניהול משא ומתן מול הבנקים ושימוש נכון בתמהילי משכנתא אופטימליים.",
    content: "ניהול משא ומתן אפקטיבי מול הבנקים יכול לחסוך לכם עשרות אלפי שקלים. הנה הטיפים שלנו: 1) קבלו הצעות מכמה בנקים. 2) הבינו את סוגי המסלולים. 3) אל תפחדו לבקש הנחה.",
    category: "מחשבונים",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80",
    author: "הצוות הכלכלי",
    authorRole: "",
    date: "2024-11-20",
  },
  {
    id: "3",
    title: "טיפים לרוכשי דירה ראשונה: מה לא מספרים לכם?",
    excerpt: "הוצאות נלוות, בדיקות מקדימות וכל מה שחשוב לדעת לפני שחותמים על העסקה הגדולה.",
    content: "רכישת דירה ראשונה היא אחד הצעדים הגדולים בחיים. הנה כמה דברים שחשוב לדעת: מס רכישה, שכר טרחת עורך דין, דמי תיווך, ביטוח משכנתא ועוד.",
    category: "מדריך לקונים",
    imageUrl: "https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&q=80",
    author: "הצוות הכלכלי",
    authorRole: "",
    date: "2024-10-05",
  },
  {
    id: "4",
    title: "איחוד הלוואות לתוך המשכנתא: האם זה כדאי?",
    excerpt: "הדרך לצמצם את ההחזר החודשי באמצעות נכס קיים.",
    content: "איחוד הלוואות לתוך המשכנתא יכול להפחית משמעותית את ההחזר החודשי. אבל חשוב להבין את היתרונות והחסרונות לפני שמקבלים החלטה.",
    category: "איחוד הלוואות",
    imageUrl: "https://images.unsplash.com/photo-1460472178825-e5240623afd5?w=800&q=80",
    author: "הצוות הכלכלי",
    authorRole: "",
    date: "2024-09-12",
  },
];

const STORAGE_KEY = "habait_blog_posts";

export function loadPosts(): BlogPost[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return defaultPosts;
}

export function savePosts(posts: BlogPost[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}
