from device.agent import collect_status


def test_collect_status_has_required_fields() -> None:
    status = collect_status()
    assert status["hostname"]
    assert status["python_version"]
    assert status["disk_total_bytes"] > 0
    assert status["disk_free_bytes"] > 0
    assert status["cpu_load_1m"] >= 0

