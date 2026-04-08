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
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaN6Oo87XkS5y-g7uoa_SU-puVYCNpeAnOukqU9z6-LjAD3AMg5k9CVALqv4JbdTKVkRs2Qo7QwydoRWL4U9yTBaZLyDvixhGpHmNN4RXxcoq4utUbTAeiH9lQhWIqs_ITgkZI9U-yNPmlKYKgfpiV1Qt5tktbzEf2UK9BQu7Wz13bEv9VjQlXrYPnsSO0USd-wihD9Htp7feQnjbWp3qBIzDRGUg2lAVoN5j1EZpaa1vyn4pWAfRv22JvMsEpQaVleMz1Gy0f",
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
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDyjndA-wY1q_-Co2H0fqssQh-RzBab6ug63u35kA9Hh6xoWVzr14P6B4q1rKz4t2UX3VQKp2r4musD3urCxfMD2FL4tQU-DmKjeJ3TdE_vCxQ94Op172FFZu_HZHXaafv5NzYWcHnF38912b6_YayOlCMEseAJdENd1XJa_WYniJaG1Tdk7r2v8Zfvb7M2KYCqrtrx1u3DrgWu5FULbs8H4cOVWlRuHkoaazY78XNVcvj14wTGBzzSJdS_BJLqP2g0lCYt6fAj",
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
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCRzNSJqYHtQpiEN88Jmudw-c3iyIBIQ9Kaurdz6rZx87y4gT16UhLFizuAbVF6C-x_32L5gF5ADC0NGtGerhhR5DlEyU-ejXVde2KwtL7K7ZEOt9hGr_OawP1iVLNsNWymisXAAClLntVkLiIgwxAQtNhZbq9s2T1jTYV5JGAqq-lI9sW_K1_XbWddihETWOoYP-nU7pkHUNM9LPm506xa_-YtyAIuFbbobWxAq7NcQ_uxcm2bI5BpdTATBudzl7XPY4hWvqu3",
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
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAbX2Y73SG9ryEKZrIxOSTWDvrm7I7YP205bh85v1P9-feixmwqKT4pd6pZ1C-WmlrI1iI7hOo4VwjAuc_iiLwV3maRvoCS-afPWzwAcCjTdM87-i9EQeaKZgmshWfpPTAVdH7F2_ZafHn94xnhuyAD19E5nurtiSOyi3gxlbcpQtKPWaYIygyAVuEUo2_x_AWoVe6PE1ZKnTJbzZqJP42A3WwhTu81_zeJ_GVP3QeOiM4f0u6scOSXWTU2P5frW5_w2F4xf94N",
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
