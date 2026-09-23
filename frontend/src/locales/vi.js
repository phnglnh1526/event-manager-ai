export const ROLE_LABELS = {
  ADMIN: "Quản trị viên",
  ORGANIZER: "Ban tổ chức",
  STAFF: "Nhân viên",
  ATTENDEE: "Người tham dự",
};

export const EVENT_STATUS_LABELS = {
  ALL: "Tất cả",
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  COMPLETED: "Đã kết thúc",
  CANCELLED: "Đã hủy",
};

export const REGISTRATION_STATUS_LABELS = {
  REGISTERED: "Đã đăng ký",
  CANCELLED: "Đã hủy",
};

export const TICKET_STATUS_LABELS = {
  ACTIVE: "Hợp lệ",
  USED: "Đã check-in",
  VOID: "Vô hiệu hóa",
  CANCELLED: "Đã hủy",
};

export const ANNOUNCEMENT_STATUS_LABELS = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã đăng",
};

export const vi = {
  common: {
    save: "Lưu",
    saving: "Đang lưu...",
    saveChanges: "Lưu thay đổi",
    cancel: "Hủy",
    edit: "Chỉnh sửa",
    delete: "Xóa",
    create: "Tạo mới",
    update: "Cập nhật",
    updating: "Đang cập nhật...",
    search: "Tìm kiếm",
    filter: "Lọc",
    loading: "Đang tải...",
    processing: "Đang xử lý...",
    actions: "Thao tác",
    confirm: "Xác nhận",
    close: "Đóng",
    back: "Quay lại",
    next: "Tiếp theo",
    previous: "Trước",
    viewDetails: "Xem chi tiết",
    noData: "Chưa có dữ liệu",
    all: "Tất cả",
    success: "Thành công",
    error: "Lỗi",
    warning: "Cảnh báo",
    status: "Trạng thái",
    time: "Thời gian",
    date: "Ngày",
    location: "Địa điểm",
    description: "Mô tả",
    details: "Chi tiết",
    required: "Bắt buộc",
    refresh: "Làm mới",
  },
  navigation: {
    analytics: "Phân tích",
    events: "Sự kiện",
    announcements: "Thông báo",
    users: "Người dùng",
    profile: "Hồ sơ",
    logout: "Đăng xuất",
    login: "Đăng nhập",
    register: "Đăng ký",
    checkIn: "Check-in",
    myRegistrations: "Sự kiện đã đăng ký",
    myTickets: "Vé của tôi",
  },
};

export function formatDateTimeVi(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 16).replace("T", " ");
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}

export function formatDateVi(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(value);
  }
}
