import pytest
from backend.services.image_gen import (
    build_image_prompt,
    get_aspect_ratio,
    parse_task_works,
    build_video_script_prompt,
    get_youtube_thumbnail,
)


def test_build_image_prompt_includes_topic():
    prompt = build_image_prompt(
        topic="Startups colombianas en 2026",
        platform="Instagram",
        caption="El ecosistema crece.",
        brand_context="",
        extra_specs="",
    )
    assert "Startups colombianas en 2026" in prompt
    assert "Instagram" in prompt


def test_build_image_prompt_includes_brand_and_specs():
    prompt = build_image_prompt(
        topic="Innovación",
        platform="LinkedIn",
        caption="",
        brand_context="Marca seria y profesional",
        extra_specs="Colores azul y blanco",
    )
    assert "Colores azul y blanco" in prompt
    assert "Marca seria y profesional" in prompt


def test_get_aspect_ratio_by_platform():
    assert get_aspect_ratio("Instagram") == "1:1"
    assert get_aspect_ratio("TikTok") == "9:16"
    assert get_aspect_ratio("LinkedIn") == "16:9"
    assert get_aspect_ratio("YouTube") == "16:9"
    assert get_aspect_ratio("Otra") == "1:1"


def test_parse_task_works_returns_urls():
    data = {
        "status": "succeed",
        "works": [{"url": "https://cdn.kie.ai/img1.jpg"}, {"url": "https://cdn.kie.ai/img2.jpg"}],
    }
    assert parse_task_works(data) == ["https://cdn.kie.ai/img1.jpg", "https://cdn.kie.ai/img2.jpg"]


def test_parse_task_works_empty_on_failure():
    assert parse_task_works({"status": "failed", "works": []}) == []
    assert parse_task_works({}) == []


def test_build_video_script_prompt_includes_topic():
    prompt = build_video_script_prompt(
        topic="El poder del networking",
        platform="TikTok",
        caption="Conectar es crecer.",
        hashtags="#networking #startups",
        brand_context="",
    )
    assert "El poder del networking" in prompt
    assert "TikTok" in prompt
    assert "HOOK" in prompt
    assert "CTA" in prompt


def test_get_youtube_thumbnail_standard_url():
    url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    thumb = get_youtube_thumbnail(url)
    assert thumb == "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"


def test_get_youtube_thumbnail_short_url():
    url = "https://youtu.be/dQw4w9WgXcQ"
    thumb = get_youtube_thumbnail(url)
    assert thumb == "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"


def test_get_youtube_thumbnail_non_youtube():
    assert get_youtube_thumbnail("https://trends.google.com/trends") is None
    assert get_youtube_thumbnail("") is None
