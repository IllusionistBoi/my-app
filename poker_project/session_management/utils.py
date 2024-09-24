import random
import string


def generate_session_id(length=3, segments=3):
    """Generate a random session ID in the format of 'XXX-XXX-XXX'."""
    segments_list = []
    for _ in range(segments):
        segment = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        segments_list.append(segment)
    return '-'.join(segments_list)
