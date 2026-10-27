"""Synthetic regression tests only; no source book, network or billed API calls."""
import importlib.util, unittest, io, json, sys
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch
from pathlib import Path

def script(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).resolve().parents[1]/'scripts'/f'{name}.py')
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod

google=script('google-narration');align=script('align-book')
class Narration(unittest.TestCase):
    def test_zero_spend_rejects_google_modes_before_auth_or_source_access(self):
        self.assertFalse(google.GOOGLE_REQUESTS_ALLOWED)
        for mode in [['--check'],['--generate','--max-cost-usd','1000000'],['--sample','--generate','--max-cost-usd','0.02']]:
            with patch.object(sys,'argv',['google-narration.py','--book','missing-private-book.json','--project','project-89a9b506-ff91-4cd1-a2d',*mode]),patch.object(google,'access_token') as auth,patch.object(google.urllib.request,'urlopen') as request,redirect_stderr(io.StringIO()) as errors:
                with self.assertRaises(SystemExit) as stopped:google.main()
                self.assertEqual(stopped.exception.code,2)
                self.assertIn('zero-spend policy',errors.getvalue())
                auth.assert_not_called();request.assert_not_called()
    def test_zero_spend_blocks_direct_provider_and_credential_boundaries(self):
        with patch.object(google.urllib.request,'urlopen') as request,patch.object(google.subprocess,'check_output') as process:
            with self.assertRaisesRegex(ValueError,'zero-spend policy'):google.open_google('https://texttospeech.googleapis.com',30)
            with self.assertRaisesRegex(ValueError,'zero-spend policy'):google.access_token()
            with self.assertRaisesRegex(ValueError,'zero-spend policy'):google.check_voice('fixture-project','en-GB-Neural2-A','fixture-not-a-token')
            request.assert_not_called();process.assert_not_called()
    def test_offline_preflight_remains_available_with_zero_approved_spend(self):
        fixture=Path(__file__).parent/'fixtures'/'book.json'
        with patch.object(sys,'argv',['google-narration.py','--book',str(fixture)]),patch.object(google.urllib.request,'urlopen') as request,redirect_stdout(io.StringIO()) as output:
            google.main()
            report=json.loads(output.getvalue().splitlines()[0])
            self.assertFalse(report['googleRequestsAllowed']);self.assertEqual(report['maximumApprovedSpendUSD'],0)
            request.assert_not_called()
    def test_provider_marks_unicode_and_billing(self):
        req=google.word_requests('Café 🌿 & a quiet thought.', 'en-GB-Neural2-A',.95)[0]
        self.assertLessEqual(len(req['payload']['input']['ssml'].encode()),4800)
        self.assertIn('&amp;',req['payload']['input']['ssml'])
        self.assertEqual(req['marks'][2]['from'],8)
        self.assertNotIn('<mark',__import__('re').sub(r'<mark\b[^>]*/>','',req['payload']['input']['ssml']))
        points=[{'markName':m['name'],'timeSeconds':i*.3} for i,m in enumerate(req['marks'])]+[{'markName':'END','timeSeconds':len(req['marks'])*.3}]
        cues=google.point_cues(req,{'timepoints':points},3)
        self.assertEqual(cues[1]['to']-cues[1]['from'],2)
        with self.assertRaises(ValueError):google.point_cues(req,{'timepoints':points[:-1]},3)
        points[1]['timeSeconds']=0
        with self.assertRaises(ValueError):google.point_cues(req,{'timepoints':points},3)
    def test_chunk_limits_preserve_all_words(self):
        text='Warm narration & natural phrasing. '*90
        requests=google.word_requests(text,'en-GB-Neural2-A',.95)
        self.assertGreater(len(requests),1)
        self.assertEqual(sum(len(r['marks']) for r in requests),len(text.split()))
        self.assertTrue(all(len(r['payload']['input']['ssml'].encode())<=4800 for r in requests))
        with self.assertRaises(ValueError):google.word_requests('x'*5000,'en-GB-Neural2-A',.95)
    def test_alignment_only_maps_known_words_without_guessing(self):
        source=[{'page':1,'text':'Café 🌿 quiet. Missing'}]
        segments,stats=align.map_words(source,[{'word':'Café','start':0,'end':.2},{'word':'🌿','start':.3,'end':.4},{'word':'quiet.','start':.5,'end':.8}],1)
        self.assertEqual(segments[0]['text'],source[0]['text'])
        self.assertEqual(stats['alignedWords'],3)
        self.assertEqual(segments[0]['words'][1]['to']-segments[0]['words'][1]['from'],2)
        self.assertEqual(segments[0]['words'][-1]['end'],.8)
if __name__=='__main__':unittest.main()
