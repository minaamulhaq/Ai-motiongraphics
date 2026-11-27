import ast
import pathlib
import tempfile
import unittest

# Load the pure caption functions without cloud credentials or runtime packages.
source = ast.parse(pathlib.Path(__file__).with_name('worker.py').read_text())
namespace = {}
exec(compile(ast.Module(body=[node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in ('stamp','captions')],type_ignores=[]),'captions','exec'), namespace)

class CaptionsTest(unittest.TestCase):
    def test_relative_times_and_escaping(self):
        with tempfile.TemporaryDirectory() as root:
            path=pathlib.Path(root)/'captions.ass'
            namespace['captions']([{'word':'before','start':0,'end':1},{'word':'{hello}','start':11,'end':12},{'word':'world','start':12,'end':13}],10,15,path,True)
            text=path.read_text()
            self.assertIn('0:00:01.00,0:00:03.00',text)
            self.assertIn('hello world',text)
            self.assertNotIn('before',text)
            self.assertNotIn('{hello}',text)
    def test_clock_rollover(self):
        self.assertEqual(namespace['stamp'](60),'0:01:00.00')
        self.assertEqual(namespace['stamp'](-1),'0:00:00.00')

if __name__=='__main__': unittest.main()
