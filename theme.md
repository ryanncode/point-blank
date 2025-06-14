---
created: 2025-06-14T01:04:11 (UTC -04:00)
tags: [Pages]
source: https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-a-theme-to-your-github-pages-site-using-jekyll
author: 
---

# Adding a theme to your GitHub Pages site using Jekyll - GitHub Docs

> ## Excerpt
> You can personalize your Jekyll site by adding and customizing a theme.

---
You can personalize your Jekyll site by adding and customizing a theme.

## Who can use this feature?

GitHub Pages is available in public repositories with GitHub Free and GitHub Free for organizations, and in public and private repositories with GitHub Pro, GitHub Team, GitHub Enterprise Cloud, and GitHub Enterprise Server. For more information, see [GitHub’s plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans).

GitHub Pages now uses GitHub Actions to execute the Jekyll build. When using a branch as the source of your build, GitHub Actions must be enabled in your repository if you want to use the built-in Jekyll workflow. Alternatively, if GitHub Actions is unavailable or disabled, adding a `.nojekyll` file to the root of your source branch will bypass the Jekyll build process and deploy the content directly. For more information on enabling GitHub Actions, see [Managing GitHub Actions settings for a repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

People with write permissions for a repository can add a theme to a GitHub Pages site using Jekyll.

If you are publishing from a branch, changes to your site are published automatically when the changes are merged into your site's publishing source. If you are publishing from a custom GitHub Actions workflow, changes are published whenever your workflow is triggered (typically by a push to the default branch). If you want to preview your changes first, you can make the changes locally instead of on GitHub. Then, test your site locally. For more information, see [Testing your GitHub Pages site locally with Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/testing-your-github-pages-site-locally-with-jekyll).

## [Adding a theme](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-a-theme-to-your-github-pages-site-using-jekyll#adding-a-theme)

1.  On GitHub, navigate to your site's repository.
    
2.  Navigate to the publishing source for your site. For more information, see [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
    
3.  Navigate to `_config.yml`.
    
4.  In the upper right corner of the file view, click to open the file editor.
    
    ![Screenshot of a file. In the header, a button, labeled with a pencil icon, is outlined in dark orange.](https://docs.github.com/assets/cb-47646/images/help/repository/edit-file-edit-button.png)
    
    Note
    
    Instead of editing and committing the file using the default file editor, you can optionally choose to use the [github.dev code editor](https://docs.github.com/en/codespaces/the-githubdev-web-based-editor) by selecting the dropdown menu and clicking **github.dev**. You can also clone the repository and edit the file locally via GitHub Desktop by clicking **GitHub Desktop**.
    
    ![Screenshot of a file. In the header, a downwards-facing triangle icon is outlined in dark orange.](https://docs.github.com/assets/cb-18357/images/help/repository/edit-file-edit-dropdown.png)
    
5.  Add a new line to the file for the theme name.
    
    -   To use a supported theme, type `theme: THEME-NAME`, replacing THEME-NAME with the name of the theme as shown in the `_config.yml` of the theme's repository (most themes follow a `jekyll-theme-NAME` naming convention). For a list of supported themes, see [Supported themes](https://pages.github.com/themes/) on the GitHub Pages site. For example, to select the Minimal theme, type `theme: jekyll-theme-minimal`.
    -   To use any other Jekyll theme hosted on GitHub, type `remote_theme: THEME-NAME`, replacing THEME-NAME with the name of the theme as shown in the README of the theme's repository.
6.  Click **Commit changes...**
    
7.  In the "Commit message" field, type a short, meaningful commit message that describes the change you made to the file. You can attribute the commit to more than one author in the commit message. For more information, see [Creating a commit with multiple authors](https://docs.github.com/en/pull-requests/committing-changes-to-your-project/creating-and-editing-commits/creating-a-commit-with-multiple-authors).
    
8.  If you have more than one email address associated with your account on GitHub, click the email address drop-down menu and select the email address to use as the Git author email address. Only verified email addresses appear in this drop-down menu. If you enabled email address privacy, then a no-reply will be the default commit author email address. For more information about the exact form the no-reply email address can take, see [Setting your commit email address](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-email-preferences/setting-your-commit-email-address).
    
    ![Screenshot of a GitHub pull request showing a dropdown menu with options to choose the commit author email address. octocat@github.com is selected.](https://docs.github.com/assets/cb-72047/images/help/repository/choose-commit-email-address.png)
    
9.  Below the commit message fields, decide whether to add your commit to the current branch or to a new branch. If your current branch is the default branch, you should choose to create a new branch for your commit and then create a pull request. For more information, see [Creating a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).
    
    ![Screenshot of a GitHub pull request showing a radio button to commit directly to the main branch or to create a new branch. New branch is selected.](https://docs.github.com/assets/cb-27122/images/help/repository/choose-commit-branch.png)
    
10.  Click **Commit changes** or **Propose changes**.
    

## [Customizing your theme's CSS](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-a-theme-to-your-github-pages-site-using-jekyll#customizing-your-themes-css)

These instructions work best with themes that are officially supported by GitHub Pages. For a complete list of supported themes, see [Supported themes](https://pages.github.com/themes/) on the GitHub Pages site.

Your theme's source repository may offer some help in customizing your theme. For example, see [Minimal's README](https://github.com/pages-themes/minimal#customizing).

1.  On GitHub, navigate to your site's repository.
    
2.  Navigate to the publishing source for your site. For more information, see [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
    
3.  Create a new file called `/assets/css/style.scss`.
    
4.  Add the following content to the top of the file:
    
    ```
    ---
    ---
    
    @import "{{ site.theme }}";
    ```
    
5.  Add any custom CSS or Sass (including imports) you'd like immediately after the `@import` line.
    

## [Customizing your theme's HTML layout](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-a-theme-to-your-github-pages-site-using-jekyll#customizing-your-themes-html-layout)

These instructions work best with themes that are officially supported by GitHub Pages. For a complete list of supported themes, see [Supported themes](https://pages.github.com/themes/) on the GitHub Pages site.

Your theme's source repository may offer some help in customizing your theme. For example, see [Minimal's README](https://github.com/pages-themes/minimal#customizing).

1.  On GitHub, navigate to your theme's source repository. For example, the source repository for Minimal is `https://github.com/pages-themes/minimal`.
2.  In the `_layouts` folder, navigate to your theme's `_default.html` file.
3.  Copy the contents of the file.
4.  On GitHub, navigate to your site's repository.
5.  Navigate to the publishing source for your site. For more information, see [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
6.  Create a file called `_layouts/default.html`.
7.  Paste the default layout content you copied earlier.
8.  Customize the layout as you'd like.

## [Further reading](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/adding-a-theme-to-your-github-pages-site-using-jekyll#further-reading)

-   [Creating new files](https://docs.github.com/en/repositories/working-with-files/managing-files/creating-new-files)
