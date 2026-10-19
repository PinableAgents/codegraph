import copy
import os
import subprocess
import unittest
from unittest import mock

import publish
import runtime
import test_runtime as fixtures

COMMIT = 'a' * 40


class PublicationTests(unittest.TestCase):
    def setUp(self):
        fixture = fixtures.RuntimeTests()
        fixture.setUp()
        self.addCleanup(fixture.tearDown)
        fixture.records()
        self.root = fixture.root
        self.manifest = runtime.aggregate(self.root)
        self.env = {'GITHUB_REPOSITORY': 'PinableAgents/codegraph',
                    'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REF': 'refs/heads/main',
                    'GITHUB_SHA': COMMIT}

    def responses(self):
        assets = [{'name': p.name, 'state': 'uploaded', 'size': p.stat().st_size,
                   'digest': 'sha256:' + runtime.sha256(p)} for p in self.root.iterdir()]
        return [{'object': {'sha': COMMIT}}, [], {'object': {'sha': COMMIT}}, {'id': 42},
                {'object': {'sha': COMMIT}}, {'object': {'sha': COMMIT}}, assets,
                {'draft': False, 'prerelease': False, 'tag_name': self.manifest['source']['releaseTag'],
                 'html_url': 'https://example.invalid/release'}]

    def test_complete_release_validation_is_read_only(self):
        before = {p.name: p.read_bytes() for p in self.root.iterdir()}
        manifest, files = publish.validate(self.root, COMMIT)
        self.assertEqual(manifest, self.manifest)
        self.assertEqual(len(files), 26)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.root.iterdir()})

    def test_checksum_and_manifest_tampering_rejected(self):
        path = self.root / 'SHA256SUMS'
        path.write_text(path.read_text() + '0' * 64 + '  ../outside\n')
        with self.assertRaisesRegex(ValueError, 'unsafe'):
            publish.validate(self.root, COMMIT)
        runtime.write_json(self.root / 'codegraph-runtime-manifest.json', {})
        with self.assertRaisesRegex(ValueError, 'manifest mismatch'):
            publish.validate(self.root, COMMIT)

    def test_untrusted_event_branch_repository_or_source_does_not_call_api(self):
        for key, value in [('GITHUB_EVENT_NAME', 'pull_request'), ('GITHUB_EVENT_NAME', 'pull_request_target'),
                           ('GITHUB_EVENT_NAME', 'workflow_run'), ('GITHUB_EVENT_NAME', 'release'),
                           ('GITHUB_REF', 'refs/heads/topic'), ('GITHUB_REF', 'refs/tags/test'),
                           ('GITHUB_REPOSITORY', 'other/repo'), ('GITHUB_SHA', 'b' * 40),
                           ('GITHUB_SHA', '')]:
            with self.subTest(key=key, value=value), mock.patch.dict(os.environ, dict(self.env, **{key: value})), \
                 mock.patch.object(publish, 'api') as api, self.assertRaises(ValueError):
                publish.publish(self.root, COMMIT)
            api.assert_not_called()

    def test_moved_main_or_existing_tag_does_not_write(self):
        for responses in ([{'object': {'sha': 'b' * 40}}],
                          [{'object': {'sha': COMMIT}}, [{'ref': 'refs/tags/' + self.manifest['source']['releaseTag']}] ]):
            with mock.patch.dict(os.environ, self.env), \
                 mock.patch.object(publish, 'api', side_effect=responses) as api, \
                 mock.patch.object(publish.subprocess, 'run') as run, self.assertRaises(ValueError):
                publish.publish(self.root, COMMIT)
            run.assert_not_called()
            self.assertTrue(all(len(call.args) == 1 for call in api.call_args_list))

    def test_reserve_tag_then_draft_upload_verify_and_publish_stable(self):
        for event in ('push', 'workflow_dispatch'):
            with self.subTest(event=event), \
                 mock.patch.dict(os.environ, dict(self.env, GITHUB_EVENT_NAME=event)), \
                 mock.patch.object(publish, 'api', side_effect=self.responses()) as api, \
                 mock.patch.object(publish.subprocess, 'run') as run:
                publish.publish(self.root, COMMIT)
            self.assertEqual(api.call_args_list[2].args[1],
                             {'ref': 'refs/tags/' + self.manifest['source']['releaseTag'], 'sha': COMMIT})
            payload = api.call_args_list[3].args[1]
            self.assertTrue(payload['draft'])
            self.assertFalse(payload['prerelease'])
            self.assertEqual(payload['make_latest'], 'false')
            self.assertEqual(run.call_count, 1)
            self.assertNotIn('--clobber', run.call_args.args[0])
            self.assertEqual(api.call_args.kwargs, {'method': 'PATCH'})
            self.assertEqual(api.call_args.args[1], {'draft': False, 'prerelease': False, 'make_latest': 'false'})

    def test_publication_races_and_incomplete_upload_leave_draft(self):
        for failure in ('tag', 'main', 'missing-asset', 'digest', 'size'):
            responses = copy.deepcopy(self.responses())
            if failure == 'tag': responses[4]['object']['sha'] = 'b' * 40
            elif failure == 'main': responses[5]['object']['sha'] = 'b' * 40
            elif failure == 'missing-asset': responses[6].pop()
            elif failure == 'digest': responses[6][0]['digest'] = 'sha256:' + '0' * 64
            elif failure == 'size': responses[6][0]['size'] += 1
            with self.subTest(failure=failure), mock.patch.dict(os.environ, self.env), \
                 mock.patch.object(publish, 'api', side_effect=responses) as api, \
                 mock.patch.object(publish.subprocess, 'run'), self.assertRaises(ValueError):
                publish.publish(self.root, COMMIT)
            self.assertFalse(any(c.kwargs.get('method') == 'PATCH' for c in api.call_args_list))

    def test_atomic_tag_conflict_does_not_create_release(self):
        responses = self.responses()[:2] + [subprocess.CalledProcessError(1, 'gh')]
        with mock.patch.dict(os.environ, self.env), \
             mock.patch.object(publish, 'api', side_effect=responses) as api, \
             mock.patch.object(publish.subprocess, 'run') as run, self.assertRaises(subprocess.CalledProcessError):
            publish.publish(self.root, COMMIT)
        run.assert_not_called()
        self.assertEqual(api.call_count, 3)

    def test_upload_failure_does_not_publish(self):
        with mock.patch.dict(os.environ, self.env), \
             mock.patch.object(publish, 'api', side_effect=self.responses()) as api, \
             mock.patch.object(publish.subprocess, 'run', side_effect=subprocess.CalledProcessError(1, 'gh')), \
             self.assertRaises(subprocess.CalledProcessError):
            publish.publish(self.root, COMMIT)
        self.assertEqual(api.call_count, 4)


if __name__ == '__main__':
    unittest.main()
