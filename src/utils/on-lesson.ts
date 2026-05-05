import { log } from "./log.js";

export interface OnLessonClassroomItem {
  classroomId: string;
  classroomName: string;
  courseId: string;
  courseName: string;
  lessonId: string;
  role: number;
}

function getRoleLabel(role: number): string {
  if (role === 1) return "教";
  if (role === 5) return "听";
  return "未知";
}

export function formatOnLessonItem(item: OnLessonClassroomItem): string {
  return `[${getRoleLabel(item.role)}] ${item.courseName}-${item.classroomName}`;
}

async function fetchOnLessonClassrooms(): Promise<OnLessonClassroomItem[]> {
  const response = await fetch(
    "https://www.yuketang.cn/api/v3/classroom/on-lesson-upcoming-exam",
  );
  const json = await response.json();
  if (json.code !== 0 || !json.data?.onLessonClassrooms) {
    return [];
  }
  return json.data.onLessonClassrooms.map(
    (item: any): OnLessonClassroomItem => ({
      classroomId: item.classroomId,
      classroomName: item.classroomName,
      courseId: item.courseId,
      courseName: item.courseName,
      lessonId: item.lessonId,
      role: item.role,
    }),
  );
}

export function startOnLessonMonitor(
  interval: number = 10000,
  onChange: (items: OnLessonClassroomItem[]) => void,
): { stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;

  const poll = async () => {
    try {
      const items = await fetchOnLessonClassrooms();
      onChange(items);
    } catch (err) {
      log(`⚠️ Failed to fetch on-lesson data: ${err}`);
    }
  };

  poll();
  timer = setInterval(poll, interval);

  return {
    stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
