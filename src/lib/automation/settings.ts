import { Firestore } from 'firebase-admin/firestore';

export type OperatingMode = 'MANUAL' | 'ASSISTED';

export interface DailyCaps {
  totalDrafts: number;
  blogDrafts: number;
  storyDrafts: number;
}

export interface PipelineSettings {
  enabled: boolean;
}

export interface GlobalAutomationSettings {
  schemaVersion: number;
  emergencyStop: boolean;
  operatingMode: OperatingMode;
  timezone: 'Asia/Ho_Chi_Minh';
  dailyCaps: DailyCaps;
  pipelines: {
    blog: PipelineSettings;
    story: PipelineSettings;
  };
  updatedAt?: unknown;
  updatedBy?: string;
}

export type SettingsCheckResult =
  | { ok: true; settings: GlobalAutomationSettings }
  | { ok: false; errorCode: string; reason: string };

export const DEFAULT_SAFE_SETTINGS: GlobalAutomationSettings = {
  schemaVersion: 1,
  emergencyStop: true,
  operatingMode: 'MANUAL',
  timezone: 'Asia/Ho_Chi_Minh',
  dailyCaps: {
    totalDrafts: 2,
    blogDrafts: 1,
    storyDrafts: 1,
  },
  pipelines: {
    blog: { enabled: false },
    story: { enabled: false },
  },
};

export async function getAndValidateGlobalSettings(
  db: Firestore,
  pipeline: 'blog' | 'story'
): Promise<SettingsCheckResult> {
  try {
    const docRef = db.collection('ops_settings').doc('global');
    const snap = await docRef.get();

    if (!snap.exists) {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_MISSING',
        reason: 'Cấu hình ops_settings/global không tồn tại. Tự động chuyển sang trạng thái ngắt an toàn (emergencyStop=true).',
      };
    }

    const data = snap.data();
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'Dữ liệu ops_settings/global bị rỗng hoặc không hợp lệ.',
      };
    }

    // STRICT VALIDATION (Fail-closed, no coercion)
    if (data.schemaVersion !== 1) {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'schemaVersion không hợp lệ. Phải là 1.',
      };
    }

    if (data.timezone !== 'Asia/Ho_Chi_Minh') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'timezone không hợp lệ. Phải là "Asia/Ho_Chi_Minh".',
      };
    }

    if (typeof data.emergencyStop !== 'boolean') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'emergencyStop không hợp lệ. Phải là boolean.',
      };
    }

    if (data.emergencyStop === true) {
      return {
        ok: false,
        errorCode: 'AUTOMATION_EMERGENCY_STOP',
        reason: 'Hệ thống đang ở trạng thái ngắt khẩn cấp (emergencyStop=true).',
      };
    }

    const mode = data.operatingMode;
    if (mode !== 'MANUAL' && mode !== 'ASSISTED') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_MODE_NOT_ALLOWED',
        reason: `Operating mode "${mode}" không được phép trong Phase 3B. Chỉ hỗ trợ MANUAL hoặc ASSISTED.`,
      };
    }

    const pipeConfig = data.pipelines?.[pipeline];
    if (!pipeConfig || typeof pipeConfig.enabled !== 'boolean') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: `Cấu hình pipeline "${pipeline}" không hợp lệ. enabled phải là boolean.`,
      };
    }
    
    if (pipeConfig.enabled !== true) {
      return {
        ok: false,
        errorCode: 'AUTOMATION_PIPELINE_DISABLED',
        reason: `Pipeline "${pipeline}" hiện đang bị tắt (enabled=false).`,
      };
    }

    const dailyCaps = data.dailyCaps;
    if (!dailyCaps || typeof dailyCaps !== 'object') {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'Cấu hình dailyCaps bị thiếu hoặc không phải object.',
      };
    }

    if (
      !Number.isSafeInteger(dailyCaps.totalDrafts) || dailyCaps.totalDrafts <= 0 ||
      !Number.isSafeInteger(dailyCaps.blogDrafts) || dailyCaps.blogDrafts <= 0 ||
      !Number.isSafeInteger(dailyCaps.storyDrafts) || dailyCaps.storyDrafts <= 0
    ) {
      return {
        ok: false,
        errorCode: 'AUTOMATION_SETTINGS_INVALID',
        reason: 'Cấu hình dailyCaps không hợp lệ. Phải là số nguyên dương an toàn.',
      };
    }

    const settings: GlobalAutomationSettings = {
      schemaVersion: data.schemaVersion,
      emergencyStop: data.emergencyStop,
      operatingMode: mode,
      timezone: data.timezone,
      dailyCaps: {
        totalDrafts: dailyCaps.totalDrafts,
        blogDrafts: dailyCaps.blogDrafts,
        storyDrafts: dailyCaps.storyDrafts,
      },
      pipelines: {
        blog: { enabled: data.pipelines?.blog?.enabled === true },
        story: { enabled: data.pipelines?.story?.enabled === true },
      },
      updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'system',
    };

    return { ok: true, settings };
  } catch (error: unknown) {
    // DO NOT expose internal error details to client, just log and return generic
    return {
      ok: false,
      errorCode: 'AUTOMATION_SETTINGS_INVALID',
      reason: 'Lỗi hệ thống khi truy xuất ops_settings/global.',
    };
  }
}
