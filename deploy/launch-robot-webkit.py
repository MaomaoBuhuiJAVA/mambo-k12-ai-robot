#!/usr/bin/env python3
"""Open the robot page in a full-screen WebKitGTK window."""

from __future__ import annotations

import os

import gi

gi.require_version("Gtk", "3.0")
gi.require_version("WebKit2", "4.0")

from gi.repository import Gtk, WebKit2


def main() -> int:
    url = os.environ.get("ROBOT_URL", "http://192.168.1.18:3000/robot")
    window = Gtk.Window(title="Mambo Robot")
    window.fullscreen()
    window.set_default_size(800, 480)
    window.connect("destroy", Gtk.main_quit)

    context = WebKit2.WebContext.new_ephemeral()
    webview = WebKit2.WebView.new_with_context(context)
    settings = webview.get_settings()
    settings.set_property("enable-javascript", True)
    settings.set_property("enable-media-stream", True)
    settings.set_property("media-playback-requires-user-gesture", False)

    def allow_media_permission(_view: object, request: object) -> bool:
        permission_type = getattr(WebKit2, "UserMediaPermissionRequest", None)
        if permission_type is not None and isinstance(request, permission_type):
            request.allow()
            return True
        return False

    try:
        webview.connect("permission-request", allow_media_permission)
    except TypeError:
        pass

    window.add(webview)
    webview.load_uri(url)
    window.show_all()

    Gtk.main()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
