from pydantic import BaseModel, ConfigDict
from pydantic.fields import Field


class UploadImageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str = Field(description="Secure URL of the uploaded image")
    public_id: str | None = Field(default=None, description="Cloudinary public ID")
