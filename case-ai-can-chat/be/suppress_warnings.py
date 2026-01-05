"""
Warning suppression module for LangChain deprecation warnings
This module must be imported before any other modules to suppress warnings
"""

import warnings


# Set up a custom warning filter that catches LangChain deprecation warnings
class LangChainWarningFilter:
    def __init__(self):
        self.original_showwarning = warnings.showwarning

    def __call__(self, message, category, filename, lineno, file=None, line=None):
        # Check if this is a LangChain deprecation warning
        if (
            isinstance(category, DeprecationWarning)
            and "langchain" in str(message).lower()
            or "LangChainDeprecationWarning" in str(category)
            or "langchain" in filename.lower()
        ):
            return  # Suppress this warning
        # Otherwise, show the warning normally
        self.original_showwarning(message, category, filename, lineno, file, line)


# Install the custom warning filter
warnings.showwarning = LangChainWarningFilter()

# Also use standard warning filters as backup
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")
warnings.filterwarnings("ignore", message=".*LangChainDeprecationWarning.*")
warnings.filterwarnings(
    "ignore", message=".*Importing.*from langchain.*is deprecated.*"
)
warnings.filterwarnings("ignore", message=".*Please replace deprecated imports.*")
warnings.filterwarnings("ignore", message=".*HuggingFacePipeline.*")
warnings.filterwarnings("ignore", module="langchain._api.module_import")
warnings.filterwarnings("ignore", module="langchain.llms")
warnings.filterwarnings("ignore", module="langchain.utilities")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain*")
