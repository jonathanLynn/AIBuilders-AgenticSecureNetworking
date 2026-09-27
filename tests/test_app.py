from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import app as lab_app


class AppTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.client = lab_app.app.test_client()
        self.progress_path = Path(self.temp.name) / "progress"
        self.patches = [
            patch.object(lab_app, "PROGRESS_ROOT", self.progress_path),
            patch.object(lab_app, "FALLBACK_CODE", "test-code"),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        lab_app.sessions.clear()

    def login(self):
        response = self.client.post("/api/login", json={"name": "Test Candidate", "code": "test-code"})
        self.assertEqual(response.status_code, 200)
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    def test_course_has_five_modules(self):
        response = self.client.get("/api/modules", headers=self.login())
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.get_json()], ["setup", "defend", "access", "topology", "orchestrate"])

    def test_progress_round_trip(self):
        headers = self.login()
        progress = {"completed": ["setup"], "answers": {"setup": 1}}
        self.assertEqual(self.client.put("/api/progress", headers=headers, json=progress).status_code, 200)
        self.assertEqual(self.client.get("/api/progress", headers=headers).get_json(), progress)

    def test_rejects_bad_code(self):
        response = self.client.post("/api/login", json={"name": "Test Candidate", "code": "wrong"})
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
