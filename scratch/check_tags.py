import re

def check_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    lines = content.split('\n')
    balance = 0
    stack = []
    
    for i, line in enumerate(lines):
        # This is a bit naive because it doesn't handle tags spanning multiple lines
        # but let's see if it gives us a hint.
        opens = re.findall(r'<div[\s>]', line)
        closes = re.findall(r'</div\s*>', line)
        
        for _ in opens:
            balance += 1
            stack.append(i + 1)
        
        for _ in closes:
            balance -= 1
            if balance < 0:
                print(f"Extra closing div at line {i + 1}")
                balance = 0
            elif stack:
                stack.pop()
    
    if balance > 0:
        print(f"Unclosed divs opened at lines: {stack}")

if __name__ == "__main__":
    check_balance('ads.html')
