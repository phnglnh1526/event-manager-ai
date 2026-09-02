from pydantic import BaseModel


class CapacityStatistics(BaseModel):
    max_attendees: int
    registered: int
    available: int
    usage_rate: float


class RegistrationStatistics(BaseModel):
    total: int
    registered: int
    cancelled: int


class AttendanceStatistics(BaseModel):
    checked_in: int
    not_checked_in: int
    attendance_rate: float


class FeedbackStatistics(BaseModel):
    total: int
    average_rating: float | None
    rating_distribution: dict[str, int]


class EventStatisticsResponse(BaseModel):
    event_id: int
    event_title: str
    capacity: CapacityStatistics
    registrations: RegistrationStatistics
    attendance: AttendanceStatistics
    feedback: FeedbackStatistics
