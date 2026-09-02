from io import BytesIO

import qrcode


def generate_ticket_qr(ticket_code: str) -> BytesIO:
    image = qrcode.make(ticket_code)
    output = BytesIO()
    image.save(output, format="PNG")
    output.seek(0)
    return output
