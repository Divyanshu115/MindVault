document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle-btn';
    btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
    document.body.appendChild(btn);

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    btn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            btn.innerHTML = '<i class="fa-solid fa-moon"></i>';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    });
});
