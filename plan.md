Yes, Programmatic Access Tokens (PATs) are an excellent solution for Issue 1! They are specifically designed for the scenario you are described—letting a background script or dashboard connect to Snowflake without a human clicking "Approve" on a phone.

For Issue 1: Snowflake PAT
Is it good? Yes. Once you generate the token, you use it as your password in your Python/Node connection string. It will not trigger the browser redirect.
The "Network Policy" warning: Notice the warning in your screenshot. Snowflake requires a "Network Policy" (which limits which IP addresses can use the token) to be active for security.
Action: Click the "granting the token temporary access" link if it lets you bypass it, OR talk to your Snowflake Admin. Tell them: "I need to use a Programmatic Access Token for a warehouse dashboard and need my IP/Network added to the policy."
For Issue 2: Keeping it running on Windows (Locked)
Windows is a bit different from Mac, but the principle is the same: you need to prevent the CPU/Network from entering "Low Power" mode when the screen is locked.

Method 1: The "Settings" Way (No installs)

Go to Settings > System > Power & Sleep.
Under Sleep, change "When plugged in, PC goes to sleep after" to Never.
Go to Additional power settings (on the right) > Change plan settings > Change advanced power settings.
Find Wireless Adapter Settings and PCI Express > Link State Power Management. Set these to Maximum Performance when plugged in.
Result: When you press Win + L to lock, the screen goes dark, but the heart of the laptop stays 100% awake.
Method 2: Microsoft PowerToys "Awake" (The Pro Way) If you are allowed to install tools, download Microsoft PowerToys. It has a feature called "Awake."

It puts a small "blue cup" icon in your system tray (near the clock).
Right-click it and select "Keep awake indefinitely."
This overrides all other system settings. You can lock your screen, and as long as that cup is blue, your code keeps running.
Method 3: PM2 (Process Management) If you want the dashboard to start automatically even if the laptop restarts (e.g., after an update):

On your Windows terminal, run: npm install -g pm2.
Start your app with: pm2 start "npm run dev" --name dashboard.
Benefit: PM2 runs the app as a background service. It doesn't care if you are locked or even if you log out (if set up as an admin service).
My recommendation? Generate that PAT token first (it's the real "fix" for your auth headaches), and then use Method 1 + Method 2 on the Windows laptop to ensure it stays online 24/7.

Do you want me to help you update your Snowflake connection code to use the PAT token once you've generated it?