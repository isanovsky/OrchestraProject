</main>
<footer class="site-footer">
    <p>GestureOrchestra, orkestra mini yang dimainkan dengan jari. Tugas ETS kelompok kami.</p>
</footer>
<?php foreach ($pageScripts ?? [] as $script): ?>
    <script type="module" src="<?= e(url($script)) ?>"></script>
<?php endforeach; ?>
</body>
</html>
